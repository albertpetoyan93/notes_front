import { Button, Form, Input } from "antd";
import { NavLink, useLocation } from "react-router-dom";
import { BrandLockup } from "../../components/header/LeftHeader";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import "./AuthPanel.scss";

type AuthMode = "login" | "register";

const AuthPanel = ({ mode }: { mode: AuthMode }) => {
  const { login, register } = useAuth();
  const { loading } = useAuthStore();
  const location = useLocation();
  const [form] = Form.useForm();

  const onLogin = (values: { email: string; password: string }) => {
    login(values);
  };

  const onRegister = (values: {
    username: string;
    email: string;
    fullName?: string;
    password: string;
  }) => {
    register({
      username: values.username,
      email: values.email,
      fullName: values.fullName,
      password: values.password,
    });
  };

  return (
    <div className="auth-panel">
      <BrandLockup large />
      <div className="auth-card">
        <div className="auth-tabs">
          <NavLink to={{ pathname: "/auth/login", search: location.search }} end>
            Sign In
          </NavLink>
          <NavLink to={{ pathname: "/auth/register", search: location.search }}>
            Create Account
          </NavLink>
        </div>

        {mode === "login" ? (
          <Form
            form={form}
            layout="vertical"
            onFinish={onLogin}
            autoComplete="off"
            requiredMark={false}
          >
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
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: "Please enter your password" }]}
            >
              <Input.Password placeholder="Password" />
            </Form.Item>
            <Button
              className="auth-submit"
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              Sign In
            </Button>
            <p className="auth-switch">
              Don't have an account?{" "}
              <NavLink to={{ pathname: "/auth/register", search: location.search }}>
                Register here
              </NavLink>
            </p>
          </Form>
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={onRegister}
            autoComplete="off"
            requiredMark={false}
          >
            <Form.Item
              name="username"
              label="Username"
              rules={[
                { required: true, message: "Please enter your username" },
                { min: 3, message: "Username must be at least 3 characters" },
              ]}
            >
              <Input placeholder="Username" />
            </Form.Item>
            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Please enter your email" },
                { type: "email", message: "Please enter a valid email" },
              ]}
            >
              <Input placeholder="Email address" />
            </Form.Item>
            <Form.Item name="fullName" label="Full Name">
              <Input placeholder="Full Name (optional)" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: "Please enter your password" },
                { min: 6, message: "Password must be at least 6 characters" },
              ]}
            >
              <Input.Password placeholder="Password" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="Confirm Password"
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
              <Input.Password placeholder="Confirm Password" />
            </Form.Item>
            <Button
              className="auth-submit"
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              Create Account
            </Button>
            <p className="auth-switch">
              Already have an account?{" "}
              <NavLink to={{ pathname: "/auth/login", search: location.search }}>
                Sign in here
              </NavLink>
            </p>
          </Form>
        )}
      </div>
    </div>
  );
};

export default AuthPanel;
