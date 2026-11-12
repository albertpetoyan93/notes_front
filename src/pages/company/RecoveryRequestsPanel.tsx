import { Button, Empty, Input, Modal, Select, Space, message } from "antd";
import { useCallback, useEffect, useState } from "react";
import axios, { fetcherGet, fetcherPost } from "../../configs/axios";
import { useAuthStore } from "../../store/authStore";
import { useCompanyStore } from "../../store/companyStore";
import { completeRecoveryRequest } from "../../utils/companyRecovery";
import {
  requestFormOptions,
  requestState,
  requestVaultLabel,
  type RecoveryRequestRow,
  type RequestAction,
} from "./recoveryRequestState";

const actionLabel: Record<RequestAction, string> = { approve: "Approve", cancel: "Cancel", complete: "Complete" };

/** Vault recovery requests: ask, approve (another custodian), wait, then a custodian completes. */
const RecoveryRequestsPanel = ({
  companyId,
  isCustodian,
  holdsKey,
  collections,
  members,
  recoverableVaultIds,
  readOnly = false,
}: {
  companyId: number;
  isCustodian: boolean;
  holdsKey: boolean;
  collections: { id: number; name: string }[];
  members: { userId: number; email: string; e2eEnabled?: boolean }[];
  /** Vaults a request can recover now. */
  recoverableVaultIds: number[];
  /** Recovery is off: past requests as history, no form, no actions. */
  readOnly?: boolean;
}) => {
  const myId = Number(useAuthStore((state) => state.me?.id));
  const role = useCompanyStore((state) => state.companies.find((item) => item.id === companyId)?.role);
  const manager = role === "owner" || role === "admin";
  const canAsk = manager && !readOnly;
  const [rows, setRows] = useState<RecoveryRequestRow[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<{ collectionId?: number; granteeUserId?: number; permission: "view" | "edit"; reason: string }>({
    permission: "view",
    reason: "",
  });

  const load = useCallback(async () => {
    try {
      setRows(await fetcherGet(`/api/companies/${companyId}/recovery/requests`));
    } catch {
      setRows([]);
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (row: RecoveryRequestRow, action: RequestAction) => {
    setBusy(`${action}-${row.id}`);
    try {
      const base = `/api/companies/${companyId}/recovery/requests/${row.id}`;
      if (action === "complete") await completeRecoveryRequest(companyId, row.id);
      else await fetcherPost(`${base}/${action}`, {});
      message.success(action === "complete" ? `${row.granteeEmail} can now open the vault` : action === "approve" ? "Approved" : "Cancelled");
      await load();
    } catch (error: any) {
      message.error(error?.message || "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const ask = async () => {
    if (!form.collectionId || !form.granteeUserId || form.reason.trim().length < 3) {
      message.warning("Choose the vault and the person, and give a reason");
      return;
    }
    setBusy("ask");
    try {
      await axios.post(`/api/companies/${companyId}/recovery/requests`, form);
      message.success("Recovery requested. Another custodian must approve it.");
      setAsking(false);
      await load();
    } catch (error: any) {
      message.error(error?.message || "Could not request the recovery");
    } finally {
      setBusy(null);
    }
  };

  const formOptions = requestFormOptions(collections, recoverableVaultIds, members);

  const vaultName = (id: number | null) => requestVaultLabel(id, collections);

  // History when recovery is off: owners and admins only, and only if there is any.
  if (readOnly && (!manager || !rows?.length)) return null;

  return (
    <div className="recovery-requests">
      <div className="manage-head">
        <div>
          <h3>{readOnly ? "Past recovery requests" : "Recovery requests"}</h3>
          <p>The second approval is a check by another person, not extra encryption.</p>
        </div>
        {canAsk && (
          <Button
            onClick={() => {
              setForm({ permission: "view", reason: "" });
              setAsking(true);
            }}
          >
            New request
          </Button>
        )}
      </div>
      {isCustodian && !holdsKey && (
        <p className="policy-intro">You don't hold the recovery key yet. Another custodian gives it to you when they open 2keevo.</p>
      )}
      {!rows ? null : rows.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No recovery requests" />
      ) : (
        <ul className="manage-list">
          {rows.map((row) => {
            const state = requestState(row, { userId: myId, isCustodian, readOnly });
            return (
              <li key={row.id} className="manage-row">
                <div className="manage-main">
                  <strong>
                    {vaultName(row.collectionId)} → {row.granteeEmail} ({row.permission})
                  </strong>
                  <span>
                    {state.label} · {row.reason}
                  </span>
                </div>
                <Space size={6} className="manage-actions">
                  {state.actions.map((action) => (
                    <Button
                      key={action}
                      size="small"
                      type={action === "cancel" ? "default" : "primary"}
                      danger={action === "cancel"}
                      loading={busy === `${action}-${row.id}`}
                      disabled={action === "complete" && !holdsKey}
                      onClick={() => act(row, action)}
                    >
                      {actionLabel[action]}
                    </Button>
                  ))}
                </Space>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        title="Request a vault recovery"
        open={asking}
        okText="Request"
        confirmLoading={busy === "ask"}
        onOk={ask}
        onCancel={() => setAsking(false)}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Select
            placeholder="Vault"
            value={form.collectionId}
            onChange={(collectionId) => setForm((current) => ({ ...current, collectionId }))}
            options={formOptions.vaults.map((collection) => ({ value: collection.id, label: vaultName(collection.id) }))}
            notFoundContent="No vault can be recovered yet (a key holder's 2keevo makes its recovery copy)"
          />
          <Select
            placeholder="Person who gets access"
            value={form.granteeUserId}
            showSearch
            optionFilterProp="label"
            onChange={(granteeUserId) => setForm((current) => ({ ...current, granteeUserId }))}
            options={formOptions.people.map((member) => ({ value: member.userId, label: member.email }))}
            notFoundContent="Only people with end-to-end encryption on can get a vault's key"
          />
          <Select
            value={form.permission}
            onChange={(permission) => setForm((current) => ({ ...current, permission }))}
            options={[
              { value: "view", label: "View only" },
              { value: "edit", label: "Can edit" },
            ]}
          />
          <Input.TextArea
            placeholder="Why (everyone involved sees this)"
            maxLength={500}
            value={form.reason}
            onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
          />
        </Space>
      </Modal>
    </div>
  );
};

export default RecoveryRequestsPanel;
