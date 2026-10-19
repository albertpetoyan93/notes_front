import { Button, Form, Input } from "antd";
import { useState } from "react";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";

// Second sign-in step: a 6-digit code from the authenticator app, or a recovery code.
const TwoFactorStep = ({
  challengeToken,
  onBack,
}: {
  challengeToken: string;
  onBack: () => void;
}) => {
  const { verifyTwoFactor } = useAuth();
  const { loading } = useAuthStore();
  const [useRecovery, setUseRecovery] = useState(false);
  const [form] = Form.useForm();

  const submit = async (code: string) => {
    try {
      await verifyTwoFactor(challengeToken, code);
    } catch (err: any) {
      // An expired challenge cannot be retried with another code.
      if (String(err?.message || "").startsWith("Sign-in expired")) {
        onBack();
        return;
      }
      form.resetFields();
    }
  };

  return (
    <>
      <h1 className="auth-title">Two-factor authentication</h1>
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={(values: { code: string }) => submit(values.code)}
      >
        {useRecovery ? (
          <>
            <p className="auth-note">
              Enter one of the recovery codes you saved when you turned on
              two-factor authentication. Each code works once.
            </p>
            <Form.Item
              name="code"
              label="Recovery code"
              rules={[{ required: true, message: "Enter a recovery code" }]}
            >
              <Input placeholder="xxxxx-xxxxx" autoComplete="off" autoFocus />
            </Form.Item>
          </>
        ) : (
          <>
            <p className="auth-note">
              Enter the 6-digit code from your authenticator app.
            </p>
            <Form.Item
              name="code"
              rules={[
                { required: true, message: "Enter the code" },
                { len: 6, message: "The code has 6 digits" },
              ]}
            >
              <Input.OTP
                length={6}
                autoFocus
                inputMode="numeric"
                formatter={(value) => value.replace(/\D/g, "")}
                onChange={(value) => {
                  if (/^\d{6}$/.test(value)) submit(value);
                }}
              />
            </Form.Item>
          </>
        )}
        <Button
          className="auth-submit"
          type="primary"
          htmlType="submit"
          loading={loading}
          block
        >
          Verify
        </Button>
        <p className="auth-switch">
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault();
              form.resetFields();
              setUseRecovery(!useRecovery);
            }}
          >
            {useRecovery ? "Use the authenticator app" : "Use a recovery code"}
          </a>
          {" · "}
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault();
              onBack();
            }}
          >
            Back to sign in
          </a>
        </p>
      </Form>
    </>
  );
};

export default TwoFactorStep;
