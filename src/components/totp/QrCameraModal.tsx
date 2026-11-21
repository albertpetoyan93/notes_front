import { CameraOutlined, WarningFilled } from "@ant-design/icons";
import { Modal } from "antd";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { canUseCamera, readQrPixels } from "../../utils/totp";
import "./QrCameraModal.scss";

const cameraError = (error: unknown) => {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access is blocked. Allow the camera for this site in the browser's settings and try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is busy in another app. Close it and try again.";
  return "The camera could not be started.";
};

interface QrCameraModalProps {
  open: boolean;
  title?: string;
  /** Shown under the camera picture, e.g. how many codes were scanned. */
  status?: ReactNode;
  /** Keep scanning after a code is read (for transfers split across several codes). */
  continuous?: boolean;
  className?: string;
  onResult: (text: string) => void;
  onClose: () => void;
}

// Reads QR codes live from the camera. Frames are read on this device and never stored.
const QrCameraModal = ({
  open,
  title = "Scan a QR code",
  status,
  continuous,
  className,
  onResult,
  onClose,
}: QrCameraModalProps) => {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(true);
  // The latest handler, so the scan loop doesn't restart when the parent re-renders.
  const handler = useRef(onResult);
  handler.current = onResult;

  useEffect(() => {
    if (!open) return undefined;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    let last = "";
    let lastAt = 0;
    let busy = false;
    let attached: HTMLVideoElement | null = null;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    setError("");
    setStarting(true);

    const scan = async (now: number) => {
      if (stopped) return;
      frame = requestAnimationFrame(scan);
      const element = video.current;
      // About 6 reads a second is quick enough and keeps the device cool.
      if (busy || !context || !element || element.readyState < 2 || now - lastAt < 160) return;
      lastAt = now;
      const scale = Math.min(1, 960 / Math.max(element.videoWidth, element.videoHeight));
      canvas.width = Math.round(element.videoWidth * scale);
      canvas.height = Math.round(element.videoHeight * scale);
      if (!canvas.width || !canvas.height) return;
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      busy = true;
      try {
        const text = await readQrPixels(context.getImageData(0, 0, canvas.width, canvas.height));
        if (!text || stopped || text === last) return;
        last = text;
        navigator.vibrate?.(40);
        handler.current(text);
        if (!continuous) {
          stopped = true;
          cancelAnimationFrame(frame);
        }
      } finally {
        busy = false;
      }
    };

    (async () => {
      try {
        if (!canUseCamera()) throw new Error("no camera");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        // The dialog may still be mounting its content.
        for (let wait = 0; !video.current && !stopped && wait < 40; wait += 1) {
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const element = video.current;
        if (stopped || !element) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        element.srcObject = stream;
        attached = element;
        await element.play().catch(() => undefined);
        setStarting(false);
        frame = requestAnimationFrame(scan);
      } catch (startError) {
        if (!stopped) {
          setStarting(false);
          setError(cameraError(startError));
        }
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      if (attached) attached.srcObject = null;
    };
  }, [open, continuous]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={title}
      width={520}
      destroyOnHidden
      className={`qr-camera-modal${className ? ` ${className}` : ""}`}
    >
      {error ? (
        <p className="qr-camera-error" role="alert">
          <WarningFilled /> {error}
        </p>
      ) : (
        <div className="qr-camera-view">
          <video ref={video} muted playsInline aria-label="Camera picture" />
          <span className="qr-camera-frame" aria-hidden="true" />
          {starting && (
            <span className="qr-camera-starting">
              <CameraOutlined /> Starting the camera…
            </span>
          )}
        </div>
      )}
      <p className="qr-camera-hint">
        Hold the QR code inside the frame. It's read on this device; nothing is recorded or uploaded.
      </p>
      {status && <div className="qr-camera-status" aria-live="polite">{status}</div>}
    </Modal>
  );
};

export default QrCameraModal;
