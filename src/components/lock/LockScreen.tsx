import { KeyOutlined, LockOutlined } from "@ant-design/icons";
import { Button, Input } from "antd";
import { useState, type FormEvent } from "react";
import { fetcherPost } from "../../configs/axios";
import useAuth from "../../hooks/useAuth";
import { useAuthStore } from "../../store/authStore";
import { afterUnlock } from "../../utils/autoLock";
import { isCancelled, passkeysSupported, unlockWithPasskey } from "../../utils/passkeys";
import { masterKeysFor, openVault } from "../../utils/vaultKeys";
import { BrandLockup } from "../header/LeftHeader";
import "./LockScreen.scss";

// Shown instead of the vault while the session is locked. Items were dropped
// from memory on lock and load again after unlocking.
const LockScreen = ({ onUnlocked }: { onUnlocked: () => void }) => {
  const { me } = useAuthStore();
  const { logOut } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "passkey" | null>(null);
  const [error, setError] = useState("");
  // End-to-end accounts open their keys here, from the master password.
  const masterPassword = !!me?.e2eEnabled;

  const done = () => {
    setPassword("");
    afterUnlock();
    onUnlocked();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!password || busy) return;
    setBusy("password");
    setError("");
    try {
      if (masterPassword) {
        const keys = await masterKeysFor(String(me?.email || ""), password);
        if (!keys) throw new Error("Could not unlock. Try again.");
        const result = await fetcherPost("/api/auth/unlock", { authKey: keys.authKey });
        await openVault(keys.masterKey, result.keys);
      } else {
        await fetcherPost("/api/auth/unlock", { password });
      }
      done();
    } catch (unlockError: any) {
      setError(unlockError?.message || "Could not unlock. Try again.");
      setPassword("");
    } finally {
      setBusy(null);
    }
  };

  const withPasskey = async () => {
    if (busy) return;
    setBusy("passkey");
    setError("");
    try {
      const result = await unlockWithPasskey();
      // End-to-end accounts: only a passkey set up for unlock can open the keys.
      if (masterPassword && !result.vaultOpened) {
        // The server unlocked the session, but the vault didn't open here: lock it again.
        await fetcherPost("/api/auth/lock", {}).catch(() => undefined);
        setError("This passkey can't open your vault yet. Use your master password, then turn on unlock for it in Security settings.");
        return;
      }
      done();
    } catch (unlockError: any) {
      if (!isCancelled(unlockError)) {
        setError(unlockError?.message || "Could not unlock with a passkey.");
      }
    } finally {
      setBusy(null);
    }
  };

  const name = me?.fullName || me?.username || "";

  return (
    <div className="lock-screen" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <div className="lock-card">
        <div className="lock-brand">
          <BrandLockup />
        </div>
        <span className="lock-icon" aria-hidden="true">
          <LockOutlined />
        </span>
        <h1 id="lock-title" className="display-font">
          2keevo is locked
        </h1>
        <p className="lock-who">
          {name ? `${name} · ` : ""}
          {me?.email}
        </p>

        <form className="lock-form" onSubmit={submit}>
          <label htmlFor="lock-password" className="lock-label">
            {masterPassword ? "Your master password" : "Your 2keevo password"}
          </label>
          <Input.Password
            id="lock-password"
            size="large"
            autoFocus
            autoComplete="current-password"
            value={password}
            status={error ? "error" : undefined}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p className="lock-error" role="alert">
              {error}
            </p>
          )}
          <Button
            type="primary"
            size="large"
            htmlType="submit"
            block
            loading={busy === "password"}
            disabled={!password}
          >
            {busy === "password" && masterPassword ? "Opening your vault…" : "Unlock"}
          </Button>
        </form>

        {/* End-to-end accounts: passkeys set up for unlock open the keys (PRF). */}
        {passkeysSupported() && (
          <Button
            size="large"
            block
            icon={<KeyOutlined />}
            loading={busy === "passkey"}
            onClick={withPasskey}
          >
            Unlock with a passkey
          </Button>
        )}

        <p className="lock-note">
          Locked after a while without activity, to keep your vault safe on a shared or unattended
          computer.
        </p>
        <Button type="link" onClick={() => logOut()}>
          Sign out instead
        </Button>
      </div>
    </div>
  );
};

export default LockScreen;
