import { Button } from "antd";
import { useCallback, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { RecoveryKeyStep } from "../settings/EncryptionSection";
import { takeNewAccountRecovery, peekNewAccountRecovery } from "../../utils/newAccount";
import { AuthFrame } from "./AuthPanel";
import { returnPath } from "../../utils/keevoReturn";

// Right after creating an account: the recovery key, shown once. The vault
// opens only after the person confirms they saved it.
const RecoveryKeyPage = () => {
  const navigate = useNavigate();
  const [pending] = useState(peekNewAccountRecovery);
  const [confirmed, setConfirmed] = useState(false);
  const onConfirmed = useCallback((value: boolean) => setConfirmed(value), []);

  if (!pending) return <Navigate to="/" replace />;

  return (
    <AuthFrame>
      <h1 className="auth-title">Save your recovery key</h1>
      <p className="auth-note">
        Your vault is encrypted with your master password, on this device. 2keevo never sees it.
      </p>
      <RecoveryKeyStep recoveryKey={pending.recoveryKey} email={pending.email} onConfirmed={onConfirmed} />
      <Button
        className="auth-submit"
        type="primary"
        block
        disabled={!confirmed}
        onClick={() => {
          takeNewAccountRecovery();
          navigate(returnPath() || "/");
        }}
      >
        Open my vault
      </Button>
    </AuthFrame>
  );
};

export default RecoveryKeyPage;
