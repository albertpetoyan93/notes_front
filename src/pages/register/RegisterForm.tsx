import { Button, Form, Input } from "antd";
import { Link } from "react-router-dom";
import CastomCard from "../../components/customCard/CastomCard";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import "./styles.scss";

const RegisterForm = () => {
  const { register } = useAuth();
  const { loading } = useAuthStore();
  const [form] = Form.useForm();

  const onSubmit = (values: any) => {
    register(values);
  };

  return (
    <CastomCard
      title="Create Account"
      className="register-card"
      actions={[
        <Button
          type="primary"
          htmlType="submit"
          form="register-form"
          style={{ width: "86%" }}
          onClick={() => form.submit()}
          loading={loading}
          iconPosition={"end"}
        >
          Register
        </Button>,
      ]}
    >
      <Form
        id="register-form"
        form={form}
        layout="vertical"
        onFinish={(values: any) => onSubmit(values)}
        autoComplete={"off"}
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
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
          <Input placeholder="Email" />
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

        <div style={{ textAlign: "center", marginTop: "8px" }}>
          <span style={{ color: "#666" }}>Already have an account? </span>
          <Link to="/auth/login" style={{ color: "var(--primary)" }}>
            Login here
          </Link>
        </div>
      </Form>
    </CastomCard>
  );
};

export default RegisterForm;
