import { useState } from "react";
import { Button, Form, Input } from "antd";
import { NavLink } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { AuthFrame } from "./AuthPanel";

const ForgotPasswordPage = () => {
  const { requestPasswordReset } = useAuth();
  const { loading } = useAuthStore();
  const [sent, setSent] = useState("");

  const onFinish = async (values: { email: string }) => {
    const text = await requestPasswordReset(values.email);
    setSent(
      text || "If an account exists for that email, we sent a reset link."
    );
  };

  return (
    <AuthFrame>
      <h1 className="auth-title">Reset password</h1>
      {sent ? (
        <>
          <p className="auth-note">{sent}</p>
          <p className="auth-switch">
            <NavLink to="/auth/login">Back to sign in</NavLink>
          </p>
        </>
      ) : (
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <p className="auth-note">
            Enter the email on your account. We will send a link to choose a
            new password.
          </p>
          <Form.Item
            name="email"
            label="Email address"
            rules={[
              { required: true, message: "Please enter your email" },
              { type: "email", message: "Please enter a valid email" },
            ]}
          >
            <Input placeholder="Email address" />
          </Form.Item>
          <Button
            className="auth-submit"
            type="primary"
            htmlType="submit"
            loading={loading}
            block
          >
            Send reset link
          </Button>
          <p className="auth-switch">
            <NavLink to="/auth/login">Back to sign in</NavLink>
          </p>
        </Form>
      )}
    </AuthFrame>
  );
};

export default ForgotPasswordPage;
