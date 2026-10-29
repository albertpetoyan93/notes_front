import { KeyOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Input, Modal, Spin, Tag, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import { fetcherDelete, fetcherGet } from "../../configs/axios";
import axios from "../../configs/axios";
import { useAuthStore } from "../../store/authStore";
import dayjsExtra from "../../utils/dayjs";
import {
  addPasskey,
  enablePasskeyUnlock,
  isCancelled,
  passkeysSupported,
  suggestedPasskeyName,
  type PasskeyRow,
} from "../../utils/passkeys";

const errorText = (err: any, fallback: string) => err?.message || fallback;

// Password first: a session someone else got hold of can't add its own passkey.
const AddPasskeyModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: (added: PasskeyRow | null) => void;
}) => {
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setName(suggestedPasskeyName());
  }, [open]);

  const submit = async () => {
    if (!password) return;
    setBusy(true);
    try {
      const passkey = await addPasskey(password, name);
      onClose(passkey);
    } catch (err) {
      if (!isCancelled(err)) message.error(errorText(err, "Could not add the passkey"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Add a passkey"
      okText="Continue"
      onCancel={() => onClose(null)}
      onOk={submit}
      okButtonProps={{ loading: busy, disabled: !password }}
      destroyOnClose
    >
      <div className="code-modal passkey-modal">
        <p>
          Your device will ask for your face, fingerprint or screen lock. After that you can sign
          in to 2keevo without your password.
        </p>
        <label htmlFor="passkey-password">
          {useAuthStore.getState().me?.e2eEnabled ? "Your master password" : "Your 2keevo password"}
        </label>
        <Input.Password
          id="passkey-password"
          autoFocus
          value={password}
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
          onPressEnter={submit}
        />
        <label htmlFor="passkey-name">Name, so you recognise it later</label>
        <Input
          id="passkey-name"
          value={name}
          maxLength={100}
          onChange={(event) => setName(event.target.value)}
          onPressEnter={submit}
        />
      </div>
    </Modal>
  );
};

const PasskeysSection = () => {
  const [passkeys, setPasskeys] = useState<PasskeyRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const supported = passkeysSupported();
  // End-to-end accounts: a passkey can also open the vault, if it supports PRF.
  const e2e = !!useAuthStore((state) => state.me)?.e2eEnabled;

  const turnOnUnlock = async () => {
    setEnabling(true);
    try {
      const updated = await enablePasskeyUnlock();
      setPasskeys((rows) => rows?.map((row) => (row.id === updated.id ? updated : row)) || null);
      message.success(`“${updated.name}” now opens your vault too.`);
    } catch (err) {
      if (!isCancelled(err)) message.error(errorText(err, "Could not set up unlock with this passkey"));
    } finally {
      setEnabling(false);
    }
  };

  const load = useCallback(async () => {
    try {
      setPasskeys(await fetcherGet("/api/auth/passkeys"));
    } catch (err) {
      setPasskeys([]);
      message.error(errorText(err, "Could not load your passkeys"));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rename = (passkey: PasskeyRow) => {
    let next = passkey.name;
    Modal.confirm({
      title: "Rename passkey",
      icon: null,
      content: (
        <Input
          defaultValue={passkey.name}
          maxLength={100}
          autoFocus
          aria-label="Passkey name"
          onChange={(event) => {
            next = event.target.value;
          }}
        />
      ),
      okText: "Save",
      onOk: async () => {
        try {
          const { data } = await axios.patch(`/api/auth/passkeys/${passkey.id}`, { name: next });
          setPasskeys((rows) => rows?.map((row) => (row.id === passkey.id ? data : row)) || null);
        } catch (err) {
          message.error(errorText(err, "Could not rename the passkey"));
        }
      },
    });
  };

  const remove = (passkey: PasskeyRow) => {
    Modal.confirm({
      title: `Remove "${passkey.name}"?`,
      content:
        "You won't be able to sign in with it anymore. Your password keeps working. To fully clean up, also delete it from the device or password manager that holds it.",
      okText: "Remove",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await fetcherDelete(`/api/auth/passkeys/${passkey.id}`);
          setPasskeys((rows) => rows?.filter((row) => row.id !== passkey.id) || null);
        } catch (err) {
          message.error(errorText(err, "Could not remove the passkey"));
        }
      },
    });
  };

  return (
    <section className="security-section">
      <div className="security-section-head">
        <h2>Passkeys</h2>
        {supported && passkeys && passkeys.length > 0 && (
          <Button icon={<PlusOutlined />} onClick={() => setAdding(true)}>
            Add a passkey
          </Button>
        )}
      </div>
      <p className="security-section-note">
        Sign in with your face, fingerprint or screen lock instead of your password. A passkey
        can't be phished, and it replaces the 2FA code too.
      </p>

      {!passkeys ? (
        <div className="security-loading">
          <Spin />
        </div>
      ) : passkeys.length === 0 ? (
        <div className="manage-list">
          <div className="manage-row">
            <span className="manage-icon">
              <KeyOutlined />
            </span>
            <div className="manage-main">
              <strong>No passkeys yet</strong>
              <span>
                {supported
                  ? "Add one for this device. Synced passkeys (iCloud Keychain, Google Password Manager) then work on your other devices too."
                  : "This browser doesn't support passkeys. Try a recent Chrome, Edge, Safari or Firefox."}
              </span>
            </div>
            <div className="manage-actions">
              {supported && (
                <Button type="primary" onClick={() => setAdding(true)}>
                  Add a passkey
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <ul className="manage-list">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="manage-row">
              <span className="manage-icon">
                <KeyOutlined />
              </span>
              <div className="manage-main">
                <strong>
                  {passkey.name}{" "}
                  {passkey.synced ? <Tag color="purple">Synced</Tag> : <Tag>This device only</Tag>}
                  {e2e && passkey.unlocksVault && <Tag color="green">Unlocks vault</Tag>}
                </strong>
                <span>
                  {`Added ${dayjsExtra(passkey.createdAt).format("ll")} · `}
                  {passkey.lastUsedAt
                    ? `Last used ${dayjsExtra(passkey.lastUsedAt).fromNow()}`
                    : "Not used yet"}
                </span>
              </div>
              <div className="manage-actions">
                {e2e && !passkey.unlocksVault && supported && (
                  <Button size="small" loading={enabling} onClick={turnOnUnlock}>
                    Use to unlock
                  </Button>
                )}
                <Button size="small" onClick={() => rename(passkey)}>
                  Rename
                </Button>
                <Button size="small" danger onClick={() => remove(passkey)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddPasskeyModal
        open={adding}
        onClose={(added) => {
          setAdding(false);
          if (added) {
            setPasskeys((rows) => [...(rows || []), added]);
            message.success(
              e2e
                ? "Passkey added. To open your vault with it too, choose “Use to unlock”."
                : "Passkey added. Next time, choose “Sign in with a passkey”."
            );
          }
        }}
      />
    </section>
  );
};

export default PasskeysSection;
