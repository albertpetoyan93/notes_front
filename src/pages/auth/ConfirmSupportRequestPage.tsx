import { Button } from "antd";
import { useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { fetcherPost } from "../../configs/axios";
import { forgetLocalSession } from "../../hooks/useAuth";
import { AuthFrame } from "./AuthPanel";

const LINK_GONE = "This link has expired or was already used. Contact support for a new one.";

type Phase = "ready" | "done" | "gone";

// The emailed link from 2keevo support. Nothing happens until the button is
// pressed: mail scanners open links on their own.
const ConfirmSupportRequestPage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [phase, setPhase] = useState<Phase>(token ? "ready" : "gone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await fetcherPost("/api/auth/support-requests/confirm", { token });
      // Every session was signed out, this one included: drop the open vault keys too.
      forgetLocalSession();
      setPhase("done");
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Try again.");
      if (e?.message === LINK_GONE) setPhase("gone");
    } finally {
      setBusy(false);
    }
  };

  let body;
  if (phase === "done") {
    body = (
      <>
        <p className="auth-note">
          Two-step sign-in is off. You've been signed out everywhere — sign in again with your password.
        </p>
        <p className="auth-switch">
          <NavLink to="/auth/login">Sign in</NavLink>
        </p>
      </>
    );
  } else if (phase === "gone") {
    body = (
      <p className="auth-note" role="alert">
        {error || LINK_GONE}
      </p>
    );
  } else {
    body = (
      <>
        <p className="auth-note">
          2keevo support asked to turn off two-step sign-in for your account. If you confirm, signing in
          will only ask for your password, and you'll be signed out on every device.
        </p>
        <p className="auth-note">
          If you didn't ask 2keevo support for this, close this page and nothing will change.
        </p>
        {error && (
          <p className="auth-note" role="alert">
            {error}
          </p>
        )}
        <Button className="auth-submit" type="primary" loading={busy} onClick={confirm} block>
          Turn off two-step sign-in
        </Button>
      </>
    );
  }

  return (
    <div className="auth-layout">
      <AuthFrame>
        <h1 className="auth-title">Turn off two-step sign-in</h1>
        {body}
      </AuthFrame>
    </div>
  );
};

export default ConfirmSupportRequestPage;
