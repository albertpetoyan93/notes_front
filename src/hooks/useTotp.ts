import { useEffect, useMemo, useState } from "react";
import { parseTotp, secondsLeft, totpCode, totpStep } from "../utils/totp";

// The current authenticator code for a key, kept fresh while the component shows.
const useTotp = (value?: string) => {
  const config = useMemo(() => parseTotp(value), [value]);
  const [code, setCode] = useState("");
  const [left, setLeft] = useState(0);

  useEffect(() => {
    setCode("");
    if (!config || !window.crypto?.subtle) return;
    let alive = true;
    let step = -1;
    const tick = () => {
      const now = Date.now();
      setLeft(secondsLeft(config, now));
      const current = totpStep(config, now);
      if (current === step) return;
      step = current;
      totpCode(config, current)
        .then((next) => {
          if (alive) setCode(next);
        })
        .catch(() => {
          if (alive) setCode("");
        });
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [config]);

  return { config, code, left, period: config?.period || 30 };
};

export default useTotp;
