import { BankOutlined, DownOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Dropdown, Input, Modal, message } from "antd";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "../../configs/axios";
import { CompanySummary, useCompanyStore } from "../../store/companyStore";

const roleText = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const RoleMark = ({ company }: { company: CompanySummary }) => {
  const kind = company.memberStatus === "invited" ? "invite" : company.role;
  const label = company.memberStatus === "invited" ? "Invite" : roleText[company.role];
  return <span className={`company-role ${kind}`}>{label}</span>;
};

const CompanyMenu = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const companies = useCompanyStore((state) => state.companies);
  const loaded = useCompanyStore((state) => state.loaded);
  const load = useCompanyStore((state) => state.load);
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [load]);

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
      setOpen(false);
      message.success("Company created");
      navigate(`/company/${response.data.id}`);
    } catch (error: any) {
      message.error(error?.message || "Could not create the company");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  const active = companies.filter((company) => company.memberStatus === "active");
  const companyId = location.pathname.startsWith("/company/")
    ? location.pathname.split("/")[2]
    : "";
  const current = companies.find((company) => String(company.id) === companyId);

  const choose = (value: string) => {
    setMenuOpen(false);
    if (value === "personal") navigate("/notes");
    else navigate(`/company/${value}`);
  };

  return (
    <>
      {companies.length > 0 && (
        <Dropdown
          trigger={["click"]}
          open={menuOpen}
          onOpenChange={setMenuOpen}
          dropdownRender={() => (
            <div className="company-switch-menu">
              <button
                type="button"
                className={current ? "" : "active"}
                onClick={() => choose("personal")}
              >
                <UserOutlined />
                <span>Personal</span>
              </button>
              {companies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  className={current?.id === company.id ? "active" : ""}
                  onClick={() => choose(String(company.id))}
                >
                  <BankOutlined />
                  <span>{company.name}</span>
                  <RoleMark company={company} />
                </button>
              ))}
            </div>
          )}
        >
          <button type="button" className="company-switch">
            {current ? <BankOutlined /> : <UserOutlined />}
            <span className="company-switch-name">
              {current ? current.name : "Personal"}
            </span>
            {current && <RoleMark company={current} />}
            <DownOutlined className="company-switch-caret" />
          </button>
        </Dropdown>
      )}
      {active.length === 0 && (
        <Button size="small" icon={<BankOutlined />} onClick={() => setOpen(true)}>
          Create company
        </Button>
      )}
      <Modal
        title="Create company"
        open={open}
        okText="Create"
        confirmLoading={saving}
        onOk={create}
        onCancel={() => {
          setName("");
          setOpen(false);
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

export default CompanyMenu;
