import { Button, Form, Input } from "antd";
import CastomCard from "../../components/customCard/CastomCard";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import "./styles.scss";

const LoginForm = () => {
  const { login } = useAuth();
  const { loading } = useAuthStore();
  const [form] = Form.useForm();
  const onSubmit = (values: any) => {
    login(values);
  };
  return (
    <CastomCard
      title="Login"
      className="login-card"
      actions={[
        <Button
          type="primary"
          htmlType="submit"
          form="login-form"
          style={{ width: "86%" }}
          onClick={() => form.submit()}
          loading={loading}
          iconPosition={"end"}
        >
          Login
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values: any) => onSubmit(values)}
        autoComplete={"off"}
        initialValues={
          {
            //  username: "admin", password: "hyeidpass"
          }
        }
        style={{ height: "100%", display: "flex", flexDirection: "column" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Form.Item name="email" label="Email" style={{ width: "100%" }}>
            <Input placeholder="Email" />
          </Form.Item>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Form.Item name="password" label="Password" style={{ width: "100%" }}>
            <Input.Password placeholder="Password" />
          </Form.Item>
        </div>

        <div style={{ textAlign: "center", marginTop: "8px" }}>
          <span style={{ color: "#666" }}>Don't have an account? </span>
          <a href="/auth/register" style={{ color: "var(--primary)" }}>
            Register here
          </a>
        </div>
      </Form>
    </CastomCard>
  );
};

export default LoginForm;
