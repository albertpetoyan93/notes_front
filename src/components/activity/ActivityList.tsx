import { Button, Empty, Spin, Tooltip } from "antd";
import { useCallback, useEffect, useState } from "react";
import { fetcherGet } from "../../configs/axios";
import { useAuthStore } from "../../store/authStore";
import {
  type ActivityEvent,
  type ActivityPage,
  describeActivity,
  isNotableActivity,
} from "../../utils/activity";
import dayjsExtra from "../../utils/dayjs";
import { browserAndOs } from "../../utils/device";
import "./ActivityList.scss";

// A page of the audit log with "Show older". `url` may already carry filters.
const ActivityList = ({
  url,
  withTitle = true,
  emptyText = "Nothing has happened here yet.",
}: {
  url: string;
  withTitle?: boolean;
  emptyText?: string;
}) => {
  const me = useAuthStore((state) => state.me);
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [next, setNext] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fetchPage = useCallback(
    (before?: number) => {
      const joiner = url.includes("?") ? "&" : "?";
      return fetcherGet(before ? `${url}${joiner}before=${before}` : url) as Promise<ActivityPage>;
    },
    [url]
  );

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError("");
    fetchPage()
      .then((page) => {
        if (cancelled) return;
        setEvents(page.events);
        setNext(page.next);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Could not load the activity");
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPage]);

  const loadMore = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(next);
      setEvents((current) => [...(current || []), ...page.events]);
      setNext(page.next);
    } catch (err: any) {
      setError(err?.message || "Could not load the activity");
    } finally {
      setLoadingMore(false);
    }
  };

  if (error) return <p className="activity-error">{error}</p>;
  if (!events) {
    return (
      <div className="activity-loading">
        <Spin />
      </div>
    );
  }
  if (!events.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <>
      <ol className="activity-list">
        {events.map((event) => {
          const when = dayjsExtra(event.createdAt);
          const who =
            event.actorId && event.actorId === me?.id ? "You" : event.actorName || "Someone";
          const device = [browserAndOs(event.userAgent), event.ip].filter(Boolean).join(" · ");
          return (
            <li
              key={event.id}
              className={`activity-row${isNotableActivity(event.action) ? " is-notable" : ""}`}
            >
              <span className="activity-dot" aria-hidden="true" />
              <div className="activity-copy">
                <p>
                  <strong>{who}</strong> {describeActivity(event, withTitle)}
                </p>
                <span>
                  <Tooltip title={when.format("LLL")}>
                    <time dateTime={when.toISOString()}>{when.fromNow()}</time>
                  </Tooltip>
                  {device && ` · ${device}`}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
      {next && (
        <div className="activity-more">
          <Button onClick={loadMore} loading={loadingMore}>
            Show older
          </Button>
        </div>
      )}
    </>
  );
};

export default ActivityList;
