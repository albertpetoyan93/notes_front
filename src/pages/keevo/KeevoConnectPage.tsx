import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "antd";
import { BrandLockup } from "../../components/header/LeftHeader";
import { fetcherPost } from "../../configs/axios";
import useAuth from "../../hooks/useAuth";

type Phase = "checking" | "confirm" | "done" | "error";

function waitForExtension() {
  return new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve(false);
    }, 2000);

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (
        !data ||
        data.source !== "keevo-extension" ||
        data.type !== "keevo-connect-result"
      ) {
        return;
      }
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(Boolean(data.ok));
    }

    window.addEventListener("message", onMessage);
  });
}

const KeevoConnectPage = () => {
  const [params] = useSearchParams();
  const nonce = params.get("nonce") || "";
  const { getMe } = useAuth();
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!nonce) {
      setPhase("error");
      setError("Open this page from the Keevo extension.");
      return;
    }

    let cancelled = false;
    getMe()
      .then((user) => {
        if (cancelled) return;
        setEmail(user?.email || "");
        setPhase("confirm");
      })
      .catch((err: { message?: string }) => {
        if (cancelled) return;
        const message = err?.message || "";
        if (/unauthorized|not authorized/i.test(message)) return;
        setPhase("error");
        setError(message || "Could not check your account.");
      });

    return () => {
      cancelled = true;
    };
    // Confirm once for this nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  async function allow() {
    setBusy(true);
    setError("");
    try {
      const data = await fetcherPost("/api/auth/extension/connect", {});
      window.postMessage(
        {
          source: "keevo-web",
          type: "keevo-connect",
          nonce,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          email: data.user?.email || email,
        },
        window.location.origin,
      );
      const accepted = await waitForExtension();
      if (!accepted) {
        setPhase("error");
        setError("Keevo did not accept the sign-in. Reload the extension and try again.");
        return;
      }
      window.close();
      setPhase("done");
    } catch (err: any) {
      setPhase("error");
      setError(err?.message || "Could not sign Keevo in.");
    } finally {
      setBusy(false);
    }
  }

  function decline() {
    window.postMessage(
      { source: "keevo-web", type: "keevo-connect-cancel", nonce },
      window.location.origin,
    );
    window.close();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <BrandLockup large />
        {phase === "checking" && <p>Checking your account…</p>}
        {phase === "confirm" && (
          <>
            <h1 style={{ fontSize: 20, margin: "20px 0 8px" }}>
              Sign in to Keevo?
            </h1>
            <p style={{ marginBottom: 20 }}>
              Keevo will use {email || "your website account"} on this browser.
            </p>
            <Button type="primary" loading={busy} onClick={allow} block>
              Continue
            </Button>
            <Button type="text" disabled={busy} onClick={decline} block style={{ marginTop: 8 }}>
              Decline
            </Button>
          </>
        )}
        {phase === "done" && (
          <>
            <h1 style={{ fontSize: 20, margin: "20px 0 8px" }}>
              Keevo is signed in
            </h1>
            <p>You can close this window and open Keevo.</p>
          </>
        )}
        {phase === "error" && (
          <p style={{ marginTop: 20 }}>{error}</p>
        )}
      </div>
    </div>
  );
};

export default KeevoConnectPage;
