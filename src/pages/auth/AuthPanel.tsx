import { KeyOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { Button, Form, Input } from "antd";
import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BrandLockup } from "../../components/header/LeftHeader";
import { useTheme } from "../../contexts/ThemeContext";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import {
  cancelPasskeyRequest,
  passkeyAutofillSupported,
  passkeysSupported,
} from "../../utils/passkeys";
import TwoFactorStep from "./TwoFactorStep";
import "./AuthPanel.scss";

type AuthMode = "login" | "register";

export const AuthFrame = ({ children }: { children: ReactNode }) => {
  const { mode: themeMode, handleThemeChange } = useTheme();
  const nextMode = themeMode === "light" ? "dark" : "light";

  return (
    <div className="auth-panel">
      <button
        type="button"
        className="auth-theme"
        aria-label={
          nextMode === "dark" ? "Switch to dark mode" : "Switch to light mode"
        }
        onClick={() => handleThemeChange(nextMode)}
      >
        {themeMode === "light" ? <MoonOutlined /> : <SunOutlined />}
      </button>
      <BrandLockup large />
      <div className="auth-card">{children}</div>
    </div>
  );
};

const AuthPanel = ({ mode }: { mode: AuthMode }) => {
  const { login, loginWithPasskey, register } = useAuth();
  const { loading } = useAuthStore();
  const location = useLocation();
  const [form] = Form.useForm();
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const passkeyLogin = mode === "login" && !challengeToken;

  // Offer saved passkeys in the email field's suggestions, where the browser can.
  const listenForAutofill = () =>
    passkeyAutofillSupported().then((supported) => {
      if (supported) loginWithPasskey(true);
    });

  useEffect(() => {
    if (!passkeyLogin) return;
    listenForAutofill();
    return () => cancelPasskeyRequest();
    // Start once per visit to the sign-in form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passkeyLogin]);

  // The button replaces the waiting autofill request; restart it if this one is cancelled.
  const onPasskey = async () => {
    setPasskeyBusy(true);
    const signedIn = await loginWithPasskey(false);
    setPasskeyBusy(false);
    if (!signedIn) listenForAutofill();
  };

  const onLogin = async (values: { email: string; password: string }) => {
    try {
      const challenge = await login(values);
      if (challenge) setChallengeToken(challenge.challengeToken);
    } catch {
      // useAuth already shows the error.
    }
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

  if (mode === "login" && challengeToken) {
    return (
      <AuthFrame>
        <TwoFactorStep
          challengeToken={challengeToken}
          onBack={() => setChallengeToken(null)}
        />
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
        <div className="auth-tabs">
          <NavLink
            to={{ pathname: "/auth/login", search: location.search }}
            end
          >
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
              <Input placeholder="Email address" autoComplete="username webauthn" />
            </Form.Item>
            <div className="auth-password-wrap">
              <NavLink
                className="forgot-link"
                to={{ pathname: "/auth/forgot", search: location.search }}
              >
                Forgot?
              </NavLink>
              <Form.Item
                name="password"
                label="Password"
                rules={[
                  { required: true, message: "Please enter your password" },
                ]}
              >
                <Input.Password placeholder="Password" />
              </Form.Item>
            </div>
            <Button
              className="auth-submit"
              type="primary"
              htmlType="submit"
              loading={loading}
              block
            >
              Sign In
            </Button>
            {passkeysSupported() && (
              <>
                <div className="auth-or" aria-hidden="true">
                  <span>or</span>
                </div>
                <Button
                  className="auth-passkey"
                  icon={<KeyOutlined />}
                  loading={passkeyBusy}
                  onClick={onPasskey}
                  block
                >
                  Sign in with a passkey
                </Button>
              </>
            )}
            <p className="auth-switch">
              Don't have an account?{" "}
              <NavLink
                to={{ pathname: "/auth/register", search: location.search }}
              >
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
              label="Master password"
              extra="It encrypts your vault on this device. 2keevo never sees it and can't reset it; you'll get a recovery key."
              rules={[
                { required: true, message: "Please choose a master password" },
                { min: 12, message: "Use at least 12 characters" },
              ]}
            >
              <Input.Password placeholder="At least 12 characters" />
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
              <NavLink
                to={{ pathname: "/auth/login", search: location.search }}
              >
                Sign in here
              </NavLink>
            </p>
          </Form>
        )}
    </AuthFrame>
  );
};

export default AuthPanel;
