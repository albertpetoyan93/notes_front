import { Button, Space, message } from "antd";
import { useState } from "react";
import axios from "../../configs/axios";
import { useCompanyStore } from "../../store/companyStore";

const CompanyRequests = ({ compact = false }: { compact?: boolean }) => {
  const companies = useCompanyStore((state) => state.companies);
  const load = useCompanyStore((state) => state.load);
  const invites = companies.filter((company) => company.memberStatus === "invited");
  const [busyId, setBusyId] = useState<number | null>(null);

  if (!invites.length) return null;

  // Joining needs the link from the invite email (its token proves the inbox);
  // declining works here.
  const decline = async (companyId: number) => {
    setBusyId(companyId);
    try {
      await axios.post(`/api/companies/${companyId}/decline`);
      await load();
      message.success("Invite declined");
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
            <span>You are invited to this company. To join, open the link in your invitation email.</span>
          </div>
          <Space size={8}>
            <Button
              size="small"
              danger
              loading={busyId === company.id}
              onClick={() => decline(company.id)}
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
