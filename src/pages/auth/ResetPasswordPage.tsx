import { Button, Form, Input } from "antd";
import { NavLink, useSearchParams } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { AuthFrame } from "./AuthPanel";

const ResetPasswordPage = () => {
  const { resetPassword } = useAuth();
  const { loading } = useAuthStore();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const onFinish = (values: { password: string }) => {
    resetPassword(token, values.password);
  };

  return (
    <AuthFrame>
      <h1 className="auth-title">Choose a new password</h1>
      {token ? (
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="password"
            label="New password"
            rules={[
              { required: true, message: "Please enter a password" },
              { min: 6, message: "Password must be at least 6 characters" },
            ]}
          >
            <Input.Password placeholder="New password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Confirm password" />
          </Form.Item>
          <Button
            className="auth-submit"
            type="primary"
            htmlType="submit"
            loading={loading}
            block
          >
            Update password
          </Button>
        </Form>
      ) : (
        <p className="auth-note">This reset link is invalid or has expired.</p>
      )}
      <p className="auth-switch">
        <NavLink to="/auth/forgot">Request a new link</NavLink>
      </p>
    </AuthFrame>
  );
};

export default ResetPasswordPage;
