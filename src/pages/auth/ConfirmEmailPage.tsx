import { Spin } from "antd";
import { useEffect, useRef, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { fetcherPost } from "../../configs/axios";
import { confirmedSignedInAccount } from "../../components/shell/confirmEmailRule";
import { useAuthStore } from "../../store/authStore";
import { AuthFrame } from "./AuthPanel";

// The link from the confirmation email (F15): /auth/confirm-email?token=...
const ConfirmEmailPage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<{ email?: string; error?: string } | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return; // single-use link: don't post twice (StrictMode)
    sent.current = true;
    if (!token) {
      setState({ error: "This link isn't complete. Open the link from the email again." });
      return;
    }
    fetcherPost("/api/auth/email/confirm", { token })
      .then((result: { email: string }) => {
        setState({ email: result.email });
        const me = useAuthStore.getState().me;
        if (confirmedSignedInAccount(me, result.email)) useAuthStore.getState().setStore({ me: { ...me, emailVerified: true } });
      })
      .catch((error: any) =>
        setState({ error: `${error?.message || "This link is invalid or has expired."} Sign in to send a new one.` })
      );
  }, [token]);

  // Outside PublicLayout (which sends signed-in people to the vault), so it brings its own frame.
  return (
    <div className="auth-layout">
    <AuthFrame>
      <h1 className="auth-title">Confirm your email</h1>
      {!state && <Spin />}
      {state?.email && (
        <p className="auth-note">
          <strong>{state.email}</strong> is confirmed. Invites and items shared to it now reach you.
        </p>
      )}
      {state?.error && <p className="auth-note">{state.error}</p>}
      {state && (
        <p className="auth-switch">
          <NavLink to="/">Open your vault</NavLink>
        </p>
      )}
    </AuthFrame>
    </div>
  );
};

export default ConfirmEmailPage;
