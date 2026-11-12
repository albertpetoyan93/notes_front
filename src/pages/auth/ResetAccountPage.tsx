import { Alert, Button, Form, Input, Spin, message } from "antd";
import { useEffect, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { fetcherPost } from "../../configs/axios";
import { createAccountKeys } from "../../crypto/account";
import { masterPasswordProblems } from "../../utils/masterPassword";
import { RecoveryKeyStep } from "../settings/EncryptionSection";
import { AuthFrame } from "./AuthPanel";
import { resetAccountSteps, type ResetAccountCheck } from "./resetAccountSteps";

interface Values {
  password: string;
  confirmPassword: string;
  confirm: string;
}

/**
 * The link from the "forgot password" email of an end-to-end account, for
 * someone who lost their recovery key too: new keys made here, personal items
 * deleted, company access back from the company. The recovery key is shown
 * and confirmed before anything is sent.
 */
const ResetAccountPage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [check, setCheck] = useState<ResetAccountCheck | null>(null);
  const [invalid, setInvalid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [made, setMade] = useState<{ request: Record<string, unknown>; recoveryKey: string } | null>(null);
  const [saved, setSaved] = useState(false);
  // Asked on the last step, right before sending: a code typed earlier expires
  // while the recovery key is being saved (and a wrong code ends the link).
  const [twoFactorCode, setTwoFactorCode] = useState("");
  // The reply never came: the reset may have gone through, so the recovery key stays on screen.
  const [unsure, setUnsure] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvalid("This link isn't complete. Ask for a new one from the sign-in page.");
      return;
    }
    fetcherPost("/api/auth/e2e/reset-account/check", { token })
      .then(setCheck)
      .catch((checkError: any) => setInvalid(checkError?.message || "This link is invalid or has expired."));
  }, [token]);

  const prepare = async (values: Values) => {
    setError("");
    setBusy(true);
    try {
      const problems = await masterPasswordProblems(values.password);
      if (problems.length) throw new Error(`Your new master password needs ${problems.join(", and ")}.`);
      const created = await createAccountKeys(values.password);
      setMade({ request: created.request, recoveryKey: created.recoveryKey });
    } catch (prepareError: any) {
      setError(prepareError?.message || "Could not make your new keys in this browser.");
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!made) return;
    setError("");
    setBusy(true);
    try {
      await fetcherPost("/api/auth/e2e/reset-account", {
        token,
        confirm: "RESET",
        twoFactorCode: twoFactorCode.trim() || undefined,
        ...made.request,
      });
      message.success("Your account was reset. Sign in with your new master password.");
      navigate("/auth/login");
    } catch (resetError: any) {
      if (!resetError?.message) {
        // No answer from the server (network): it may have reset the account before the connection dropped.
        setUnsure(true);
        setError(
          "We didn't hear back. Try signing in with your new master password: if it works, the reset went through and the recovery key above is your new one. Keep it."
        );
        return;
      }
      // The server refused: nothing was changed, so this recovery key will never work. Start again with new keys.
      setError(`${resetError?.message || "Could not reset the account."} Nothing was changed, and the recovery key shown won't work.`);
      setMade(null);
      setSaved(false);
      // A wrong 2FA code (or a link used meanwhile) ends the link: say so instead of showing the form again.
      fetcherPost("/api/auth/e2e/reset-account/check", { token }).catch((checkError: any) =>
        setInvalid(
          `${resetError?.message || checkError?.message || "This link is invalid or has expired."} Nothing was changed.`
        )
      );
    } finally {
      setBusy(false);
    }
  };

  if (invalid) {
    return (
      <AuthFrame>
        <h1 className="auth-title">Reset your account</h1>
        <p className="auth-note">{invalid}</p>
        <p className="auth-switch">
          <NavLink to="/auth/forgot">Ask for a new link</NavLink>
        </p>
      </AuthFrame>
    );
  }
  if (!check) {
    return (
      <AuthFrame>
        <Spin />
      </AuthFrame>
    );
  }

  const steps = resetAccountSteps(check);

  return (
    <AuthFrame>
      <h1 className="auth-title">Reset your account</h1>
      {made ? (
        <>
          <RecoveryKeyStep recoveryKey={made.recoveryKey} email={check.email} onConfirmed={setSaved} />
          {error && (
            <p className="auth-note" role="alert" style={{ color: "var(--colorError)" }}>
              {error}
            </p>
          )}
          {steps.needsTwoFactor && !unsure && (
            <Form layout="vertical" requiredMark={false}>
              <Form.Item label="Two-factor code (or a recovery code)" extra={steps.twoFactorNote}>
                <Input
                  value={twoFactorCode}
                  onChange={(event) => setTwoFactorCode(event.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                />
              </Form.Item>
            </Form>
          )}
          {unsure ? (
            <Button className="auth-submit" type="primary" onClick={() => navigate("/auth/login")} block>
              Go to sign in
            </Button>
          ) : (
            <Button
              className="auth-submit"
              type="primary"
              danger
              disabled={!saved || (steps.needsTwoFactor && !twoFactorCode.trim())}
              loading={busy}
              onClick={reset}
              block
            >
              Reset my account
            </Button>
          )}
        </>
      ) : (
        <Form layout="vertical" onFinish={prepare} requiredMark={false}>
          <p className="auth-note">
            For {check.email}. Have your recovery key? <NavLink to="/auth/recover">Use it instead</NavLink>: nothing is lost.
          </p>
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
            message="This can't be undone"
            description={
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {steps.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
                <li>Your account, your companies and your family stay. Company items come back from your company.</li>
              </ul>
            }
          />
          <Form.Item name="password" label="New master password" rules={[{ required: true, message: "Choose a master password" }]}>
            <Input.Password placeholder="At least 12 characters" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Type it again"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Type it again" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue("password") === value
                    ? Promise.resolve()
                    : Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Type RESET to confirm"
            rules={[
              {
                validator: (_, value) =>
                  value === "RESET" ? Promise.resolve() : Promise.reject(new Error("Type RESET in capitals")),
              },
            ]}
          >
            <Input autoComplete="off" />
          </Form.Item>
          {error && (
            <p className="auth-note" role="alert" style={{ color: "var(--colorError)" }}>
              {error}
            </p>
          )}
          <Button className="auth-submit" type="primary" danger htmlType="submit" loading={busy} block>
            Continue
          </Button>
          <p className="auth-switch">
            <NavLink to="/auth/login">Back to sign in</NavLink>
          </p>
        </Form>
      )}
    </AuthFrame>
  );
};

export default ResetAccountPage;
