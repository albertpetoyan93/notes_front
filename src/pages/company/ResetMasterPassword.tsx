import { UnlockOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Tooltip, message } from "antd";
import { useState } from "react";
import { resetMemberPassword } from "../../utils/companyRecovery";
import { masterPasswordProblems } from "../../utils/masterPassword";

// Admin recovery: a temporary master password for a member who forgot theirs.
// It's made and locked in this browser; the admin gives it to the member,
// who chooses their own at next sign-in.
const ResetMasterPassword = ({ companyId, userId, email }: { companyId: number; userId: number; email: string }) => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    setOpen(false);
    setPassword("");
    setRepeat("");
    setError("");
  };

  const submit = async () => {
    setError("");
    if (password !== repeat) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const problems = await masterPasswordProblems(password);
      if (problems.length) throw new Error(`The temporary master password needs ${problems.join(", and ")}.`);
      await resetMemberPassword(companyId, userId, password);
      message.success(`Done. Give ${email} the temporary master password; they choose their own when they sign in.`, 8);
      close();
    } catch (resetError: any) {
      setError(resetError?.message || "Could not reset the master password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Tooltip title="Reset master password">
        <Button
          type="text"
          className="icon-btn"
          icon={<UnlockOutlined />}
          aria-label={`Reset master password: ${email}`}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <Modal
        open={open}
        title={`Reset ${email}'s master password`}
        okText="Reset it"
        okButtonProps={{ loading: busy, disabled: !password || !repeat }}
        onOk={submit}
        onCancel={busy ? undefined : close}
        destroyOnHidden
      >
        <p>
          Choose a temporary master password and give it to them in person or by phone. They're signed
          out everywhere, and choose their own the next time they sign in. Their items stay as they are.
        </p>
        <label className="e2e-field">
          <span>Temporary master password</span>
          <Input.Password value={password} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} />
        </label>
        <label className="e2e-field">
          <span>Type it again</span>
          <Input.Password value={repeat} autoComplete="new-password" onChange={(event) => setRepeat(event.target.value)} />
        </label>
        {error && <p className="e2e-error">{error}</p>}
      </Modal>
    </>
  );
};

export default ResetMasterPassword;
