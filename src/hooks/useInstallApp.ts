import { useEffect, useState } from "react";
import {
  canPromptInstall,
  isAppleMobile,
  isInstalled,
  onInstallChange,
  promptInstall,
} from "../utils/installApp";

/**
 * Whether to offer "Install app", and how: the browser's prompt, or (iPhone,
 * iPad) the Share → Add to Home Screen steps.
 */
const useInstallApp = () => {
  const [, rerender] = useState(0);
  useEffect(() => onInstallChange(() => rerender((value) => value + 1)), []);

  const installed = isInstalled();
  const prompt = !installed && canPromptInstall();
  const appleSteps = !installed && !prompt && isAppleMobile();
  return {
    available: prompt || appleSteps,
    appleSteps,
    install: promptInstall,
  };
};

export default useInstallApp;
