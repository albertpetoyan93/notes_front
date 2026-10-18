import { BankOutlined, PlusOutlined, SwapOutlined, UserOutlined } from "@ant-design/icons";
import { Dropdown, Input, Modal, message } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../../configs/axios";
import { CompanySummary, useCompanyStore } from "../../store/companyStore";

const roleText = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const RoleMark = ({ company }: { company: CompanySummary }) => {
  const kind = company.memberStatus === "invited" ? "invite" : company.role;
  const label = company.memberStatus === "invited" ? "Invite" : roleText[company.role];
  return <span className={`company-role ${kind}`}>{label}</span>;
};

// The card at the top of the sidebar: which vault is open, and a menu to switch or create one.
const VaultSwitcher = ({ companyId }: { companyId: number | null }) => {
  const navigate = useNavigate();
  const companies = useCompanyStore((state) => state.companies);
  const [menuOpen, setMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const current = companies.find((company) => company.id === companyId);

  const choose = (value: string) => {
    setMenuOpen(false);
    navigate(value === "personal" ? "/notes" : `/company/${value}`);
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      message.warning("Enter a company name");
      return;
    }
    setSaving(true);
    try {
      const response = await axios.post("/api/companies", { name: trimmed });
      useCompanyStore.setState((state) => ({
        companies: [...state.companies, response.data],
      }));
      setName("");
      setCreateOpen(false);
      message.success("Company created");
      navigate(`/company/${response.data.id}`);
    } catch (error: any) {
      message.error(error?.message || "Could not create the company");
    } finally {
      setSaving(false);
    }
  };

  const title = current ? current.name : "Personal";
  const kind = current ? `Team vault · ${roleText[current.role]}` : "Personal vault";

  return (
    <>
      <Dropdown
        trigger={["click"]}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        dropdownRender={() => (
          <div className="vault-menu" role="menu">
            <div className="vault-menu-heading">Vaults</div>
            <button
              type="button"
              role="menuitem"
              className={current ? "" : "active"}
              onClick={() => choose("personal")}
            >
              <UserOutlined />
              <span className="vault-menu-name">Personal</span>
            </button>
            {companies.map((company) => (
              <button
                key={company.id}
                type="button"
                role="menuitem"
                className={current?.id === company.id ? "active" : ""}
                onClick={() => choose(String(company.id))}
              >
                <BankOutlined />
                <span className="vault-menu-name">{company.name}</span>
                <RoleMark company={company} />
              </button>
            ))}
            <div className="vault-menu-divider" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setCreateOpen(true);
              }}
            >
              <PlusOutlined />
              <span className="vault-menu-name">Create company</span>
            </button>
          </div>
        )}
      >
        <button type="button" className="vault-switch" aria-label={`Vault: ${title}. Switch vault`}>
          <span className="vault-tile display-font">{title.trim().charAt(0).toUpperCase()}</span>
          <span className="vault-text">
            <span className="vault-name">{title}</span>
            <span className="vault-kind">{kind}</span>
          </span>
          <SwapOutlined className="vault-caret" />
        </button>
      </Dropdown>
      <Modal
        title="Create company"
        open={createOpen}
        okText="Create"
        confirmLoading={saving}
        onOk={create}
        onCancel={() => {
          setName("");
          setCreateOpen(false);
        }}
        destroyOnClose
      >
        <Input
          autoFocus
          maxLength={100}
          placeholder="Company name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onPressEnter={create}
        />
      </Modal>
    </>
  );
};

export default VaultSwitcher;
