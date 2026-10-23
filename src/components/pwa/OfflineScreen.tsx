import { DisconnectOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { BrandLockup } from "../header/LeftHeader";
import "../lock/LockScreen.scss";

// Opening the app with no connection: say so, instead of asking to sign in.
const OfflineScreen = ({ onRetry }: { onRetry: () => void }) => (
  <div className="lock-screen" role="status">
    <div className="lock-card">
      <div className="lock-brand">
        <BrandLockup />
      </div>
      <span className="lock-icon" aria-hidden="true">
        <DisconnectOutlined />
      </span>
      <h1 className="display-font">You're offline</h1>
      <p className="lock-note">
        2keevo keeps your vault on its servers, not on this device, so it needs a connection.
        It opens by itself when you're back online.
      </p>
      <Button type="primary" size="large" block onClick={onRetry}>
        Try again
      </Button>
    </div>
  </div>
);

export default OfflineScreen;
