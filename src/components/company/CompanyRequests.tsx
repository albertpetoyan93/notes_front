import { Button, Space, message } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../configs/axios";
import { useCompanyStore } from "../../store/companyStore";

const CompanyRequests = ({ compact = false }: { compact?: boolean }) => {
  const navigate = useNavigate();
  const companies = useCompanyStore((state) => state.companies);
  const load = useCompanyStore((state) => state.load);
  const invites = companies.filter((company) => company.memberStatus === "invited");
  const [busyId, setBusyId] = useState<number | null>(null);

  if (!invites.length) return null;

  const respond = async (companyId: number, action: "accept" | "decline") => {
    setBusyId(companyId);
    try {
      await axios.post(`/api/companies/${companyId}/${action}`);
      await load();
      message.success(action === "accept" ? "Joined the company" : "Invite declined");
      if (action === "accept") navigate(`/company/${companyId}`);
    } catch (error: any) {
      message.error(error?.message || "Could not update the invite");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={compact ? "company-requests compact" : "company-requests"}>
      {invites.map((company) => (
        <div key={company.id} className="company-request">
          <div className="company-request-copy">
            <strong>{company.name}</strong>
            <span>You are invited to this company.</span>
          </div>
          <Space size={8}>
            <Button
              type="primary"
              size="small"
              loading={busyId === company.id}
              onClick={() => respond(company.id, "accept")}
            >
              Accept
            </Button>
            <Button
              size="small"
              danger
              disabled={busyId === company.id}
              onClick={() => respond(company.id, "decline")}
            >
              Decline
            </Button>
          </Space>
        </div>
      ))}
    </div>
  );
};

export default CompanyRequests;
