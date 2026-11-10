import { Button, Result, Spin } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "../../configs/axios";
import { useAuthStore } from "../../store/authStore";
import { useCompanyStore } from "../../store/companyStore";

/**
 * The link in a company invite email (/invite?company=…&token=…). Joining needs
 * that single-use token, so only whoever reads the invited inbox can accept.
 * Signed out, the app signs in first and comes back here (next=).
 */
const InvitePage = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const me = useAuthStore((state) => state.me);
  const companies = useCompanyStore((state) => state.companies);
  const loadCompanies = useCompanyStore((state) => state.load);
  const companyId = Number(params.get("company")) || null;
  const token = params.get("token") || "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  const company = companies.find((item) => item.id === companyId);

  if (!companyId || !token) {
    return (
      <Result
        status="warning"
        title="This invite link isn't complete"
        subTitle="Open the link from your invitation email again, or ask for a new invite."
        extra={<Button onClick={() => navigate("/notes")}>Back to your vault</Button>}
      />
    );
  }

  // Already in (e.g. the link opened twice).
  if (company?.memberStatus === "active") {
    return (
      <Result
        status="success"
        title={`You're in ${company.name}`}
        extra={
          <Button type="primary" onClick={() => navigate(`/company/${company.id}`)}>
            Open {company.name}
          </Button>
        }
      />
    );
  }

  const join = async () => {
    setBusy(true);
    setError("");
    try {
      await axios.post(`/api/companies/${companyId}/accept`, { token });
      await loadCompanies();
      navigate(`/company/${companyId}`, { replace: true });
    } catch (joinError: any) {
      setError(
        joinError?.response?.status === 404
          ? `This invite isn't for ${me?.email || "this account"}, or it has expired. Sign in with the address the invite was sent to, or ask for a new invite.`
          : joinError?.message || "Could not join the company"
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Result
      status="info"
      title={company ? `Join ${company.name}` : "Join the company"}
      subTitle={
        error ||
        `You were invited to a company on 2keevo. You'll join as ${me?.email || "this account"}; your personal vault stays private.`
      }
      icon={busy ? <Spin size="large" /> : undefined}
      extra={[
        <Button key="join" type="primary" loading={busy} onClick={join}>
          Join
        </Button>,
        <Button key="back" onClick={() => navigate("/notes")}>
          Not now
        </Button>,
      ]}
    />
  );
};

export default InvitePage;
