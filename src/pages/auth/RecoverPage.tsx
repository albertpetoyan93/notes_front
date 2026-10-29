import { Button, Form, Input, message } from "antd";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { fetcherPost } from "../../configs/axios";
import { openWithRecovery, recoveryProof, relockForPassword } from "../../crypto/account";
import { masterPasswordProblems } from "../../utils/masterPassword";
import { AuthFrame } from "./AuthPanel";

interface Values {
  email: string;
  recoveryKey: string;
  password: string;
  confirmPassword: string;
}

// Forgot the master password: the recovery key opens the vault key here, in
// the browser, and a new master password locks it again. Nothing is lost.
const RecoverPage = () => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onFinish = async (values: Values) => {
    setBusy(true);
    setError("");
    try {
      const problems = await masterPasswordProblems(values.password);
      if (problems.length) throw new Error(`Your new master password needs ${problems.join(", and ")}.`);
      let proof: string;
      try {
        proof = await recoveryProof(values.recoveryKey);
      } catch {
        throw new Error("That recovery key isn't complete: it has 8 groups of 4 characters.");
      }
      const { recoveryProtectedUserKey } = await fetcherPost("/api/auth/e2e/recover", {
        email: values.email,
        recoveryAuth: proof,
      });
      const userKey = await openWithRecovery(values.recoveryKey, recoveryProtectedUserKey);
      const relocked = await relockForPassword(values.password, userKey);
      await fetcherPost("/api/auth/e2e/recover/complete", {
        email: values.email,
        recoveryAuth: proof,
        ...relocked,
      });
      message.success("Your master password was reset. Sign in with it now.");
      navigate("/auth/login");
    } catch (recoverError: any) {
      setError(recoverError?.message || "Could not use that recovery key.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame>
      <h1 className="auth-title">Use your recovery key</h1>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <p className="auth-note">
          Forgot your master password? Your recovery key opens your vault here, in this browser,
          and you choose a new master password. Nothing is lost.
        </p>
        <Form.Item
          name="email"
          label="Email address"
          rules={[
            { required: true, message: "Please enter your email" },
            { type: "email", message: "Please enter a valid email" },
          ]}
        >
          <Input placeholder="Email address" autoComplete="username" />
        </Form.Item>
        <Form.Item
          name="recoveryKey"
          label="Recovery key"
          rules={[{ required: true, message: "Please enter your recovery key" }]}
        >
          <Input className="mono" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autoComplete="off" spellCheck={false} />
        </Form.Item>
        <Form.Item
          name="password"
          label="New master password"
          rules={[{ required: true, message: "Please choose a master password" }]}
        >
          <Input.Password placeholder="At least 12 characters" autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="Type it again"
          dependencies={["password"]}
          rules={[
            { required: true, message: "Please type it again" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue("password") === value
                  ? Promise.resolve()
                  : Promise.reject(new Error("Passwords do not match"));
              },
            }),
          ]}
        >
          <Input.Password placeholder="Type it again" autoComplete="new-password" />
        </Form.Item>
        {error && (
          <p className="auth-note" role="alert" style={{ color: "var(--colorError)" }}>
            {error}
          </p>
        )}
        <Button className="auth-submit" type="primary" htmlType="submit" loading={busy} block>
          Reset master password
        </Button>
        <p className="auth-switch">
          <NavLink to="/auth/login">Back to sign in</NavLink>
        </p>
      </Form>
    </AuthFrame>
  );
};

export default RecoverPage;
