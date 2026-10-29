import { Input, Modal, Segmented, message } from "antd";
import { useState } from "react";
import { useBillingStore, type BillingCompany, type DiscountRequestInput } from "../../../store/billingStore";

/** The owner asks for 50% off Team; 2keevo reviews it. */
const DiscountModal = ({
  company,
  onClose,
}: {
  company: BillingCompany | null;
  onClose: () => void;
}) => {
  const requestDiscount = useBillingStore((state) => state.requestDiscount);
  const [form, setForm] = useState<DiscountRequestInput>({
    kind: "nonprofit",
    organization: "",
    website: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  const send = async () => {
    if (!company) return;
    if (!form.organization.trim()) {
      message.warning("Enter the organization's name");
      return;
    }
    setSaving(true);
    try {
      await requestDiscount(company.id, form);
      message.success("Request sent. We'll email you when it's reviewed.");
      setForm({ kind: "nonprofit", organization: "", website: "", note: "" });
      onClose();
    } catch (error: any) {
      message.error(error?.message || "Could not send the request");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="50% off Team for nonprofits and schools"
      open={!!company}
      okText="Send request"
      confirmLoading={saving}
      onOk={send}
      onCancel={onClose}
      destroyOnClose
    >
      <div className="billing-discount-form">
        <p className="billing-hint">
          Tell us about {company?.name || "the organization"}. Once approved,
          Team costs half for as long as the company stays on it. It replaces
          any other discount.
        </p>
        <Segmented
          value={form.kind}
          onChange={(value) =>
            setForm({ ...form, kind: value as DiscountRequestInput["kind"] })
          }
          options={[
            { label: "Nonprofit", value: "nonprofit" },
            { label: "School", value: "school" },
          ]}
        />
        <Input
          maxLength={200}
          placeholder="Registered name of the organization"
          value={form.organization}
          onChange={(event) =>
            setForm({ ...form, organization: event.target.value })
          }
        />
        <Input
          maxLength={255}
          placeholder="Website, like https://example.org (optional)"
          value={form.website}
          onChange={(event) =>
            setForm({ ...form, website: event.target.value })
          }
        />
        <Input.TextArea
          maxLength={2000}
          rows={3}
          placeholder="Anything that helps us check, like a registration number (optional)"
          value={form.note}
          onChange={(event) => setForm({ ...form, note: event.target.value })}
        />
      </div>
    </Modal>
  );
};

export default DiscountModal;
