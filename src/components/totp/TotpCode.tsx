import { groupCode } from "../../utils/totp";
import "./TotpCode.scss";

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// A live authenticator code with a ring that empties as the code runs out.
const TotpCode = ({
  code,
  left,
  period,
  size = "md",
}: {
  code: string;
  left: number;
  period: number;
  size?: "sm" | "md";
}) => {
  const ending = left <= 5;
  const seconds = Math.ceil(left);
  return (
    <span className={`totp-code is-${size}${ending ? " is-ending" : ""}`}>
      <span className="totp-digits" aria-live="off">
        {code ? groupCode(code) : "··· ···"}
      </span>
      <span
        className="totp-ring"
        role="timer"
        aria-label={`${seconds} seconds left`}
        title={`${seconds} seconds left`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle className="totp-ring-track" cx="12" cy="12" r={RADIUS} />
          <circle
            className="totp-ring-bar"
            cx="12"
            cy="12"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - left / period)}
          />
        </svg>
        <span className="totp-seconds">{seconds}</span>
      </span>
    </span>
  );
};

export default TotpCode;
