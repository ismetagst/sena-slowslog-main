// Detects platform/browser and returns human-friendly instructions for
// re-enabling microphone access when getUserMedia is denied.

export type MicPlatform = "ios-safari" | "ios-chrome" | "android-chrome" | "android-firefox" | "macos-safari" | "macos-chrome" | "windows-chrome" | "windows-firefox" | "windows-edge" | "linux-chrome" | "linux-firefox" | "desktop-other" | "mobile-other";

export interface MicErrorInfo {
  kind: "denied" | "no-device" | "in-use" | "insecure" | "unsupported" | "unknown";
  rawName: string;
  message: string;
}

export const detectMicPlatform = (): MicPlatform => {
  const ua = navigator.userAgent;
  const lower = ua.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(lower) || (lower.includes("mac") && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1);
  const isAndroid = /android/.test(lower);
  const isChrome = /chrome|crios|chromium/.test(lower) && !/edg|opr|opera/.test(lower);
  const isEdge = /edg\//.test(lower);
  const isFirefox = /firefox|fxios/.test(lower);
  const isSafari = /safari/.test(lower) && !isChrome && !isEdge && !isFirefox;

  if (isIOS) return isChrome ? "ios-chrome" : "ios-safari";
  if (isAndroid) return isFirefox ? "android-firefox" : "android-chrome";
  if (lower.includes("mac")) return isSafari ? "macos-safari" : "macos-chrome";
  if (lower.includes("windows")) return isFirefox ? "windows-firefox" : isEdge ? "windows-edge" : "windows-chrome";
  if (lower.includes("linux")) return isFirefox ? "linux-firefox" : "linux-chrome";
  if (/mobile/.test(lower)) return "mobile-other";
  return "desktop-other";
};

export const classifyMicError = (err: unknown): MicErrorInfo => {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return { kind: "insecure", rawName: "InsecureContext", message: "browser blocks mic on insecure (non-HTTPS) pages" };
  }
  if (!(err instanceof DOMException)) {
    const message = err instanceof Error ? err.message : "unknown microphone error";
    if (/insecure|secure context|https/i.test(message)) {
      return { kind: "insecure", rawName: "InsecureContext", message };
    }
    return { kind: "unknown", rawName: "Error", message };
  }
  const name = err.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return { kind: "denied", rawName: name, message: err.message || "permission denied" };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
    return { kind: "no-device", rawName: name, message: err.message || "no microphone found" };
  }
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
    return { kind: "in-use", rawName: name, message: err.message || "microphone is busy" };
  }
  if (name === "TypeError") {
    return { kind: "unsupported", rawName: name, message: err.message || "browser does not support recording" };
  }
  return { kind: "unknown", rawName: name, message: err.message || "microphone error" };
};

export const getMicInstructions = (platform: MicPlatform): { title: string; steps: string[] } => {
  switch (platform) {
    case "ios-safari":
      return {
        title: "iOS · Safari",
        steps: [
          "open Settings > Safari > Microphone",
          "set this site to 'Allow', or choose 'Ask'",
          "or tap the 'aA' icon in Safari address bar > Website Settings > Microphone > Allow",
          "return here and tap 'try again'",
        ],
      };
    case "ios-chrome":
      return {
        title: "iOS · Chrome",
        steps: [
          "open Settings > Chrome > Microphone and enable it",
          "also check Settings > Privacy & Security > Microphone > Chrome",
          "return here and tap 'try again'",
        ],
      };
    case "android-chrome":
      return {
        title: "Android · Chrome",
        steps: [
          "tap the lock/tune icon next to the URL > Permissions > Microphone > Allow",
          "or go to Settings > Site settings > Microphone and allow this site",
          "if still blocked, open Android Settings > Apps > Chrome > Permissions > Microphone > Allow",
          "return here and tap 'try again'",
        ],
      };
    case "android-firefox":
      return {
        title: "Android · Firefox",
        steps: [
          "tap the shield/lock icon > Edit Site Permissions > Microphone > Allow",
          "or open Android Settings > Apps > Firefox > Permissions > Microphone > Allow",
          "return here and tap 'try again'",
        ],
      };
    case "macos-safari":
      return {
        title: "macOS · Safari",
        steps: [
          "open Safari menu > Settings > Websites > Microphone",
          "set this site to 'Allow'",
          "also check System Settings > Privacy & Security > Microphone > Safari is enabled",
          "return here and tap 'try again'",
        ],
      };
    case "macos-chrome":
    case "windows-chrome":
    case "linux-chrome":
      return {
        title: "Chrome desktop",
        steps: [
          "click the lock/tune icon left of the URL > Site settings > Microphone > Allow",
          "or open chrome://settings/content/microphone and remove this site from blocked",
          "on macOS also enable System Settings > Privacy & Security > Microphone > Chrome",
          "reload the page, return here, and tap 'try again'",
        ],
      };
    case "windows-edge":
      return {
        title: "Microsoft Edge",
        steps: [
          "click the lock icon left of the URL > Permissions for this site > Microphone > Allow",
          "or open edge://settings/content/microphone and remove this site from blocked",
          "also check Windows Settings > Privacy > Microphone is enabled for Edge",
          "reload the page, return here, and tap 'try again'",
        ],
      };
    case "windows-firefox":
    case "linux-firefox":
      return {
        title: "Firefox desktop",
        steps: [
          "click the lock icon left of the URL > Connection secure > More information > Permissions > Use the Microphone > Allow",
          "or open about:preferences#privacy > Permissions > Microphone > Settings and remove this site from blocked",
          "return here and tap 'try again'",
        ],
      };
    case "mobile-other":
      return {
        title: "mobile browser",
        steps: [
          "open your browser's site settings and allow microphone for this site",
          "open your phone's system Settings > Apps > [browser] > Permissions > Microphone > Allow",
          "return here and tap 'try again'",
        ],
      };
    default:
      return {
        title: "browser settings",
        steps: [
          "open your browser site settings (icon left of the URL) and allow microphone",
          "ensure your operating system also allows the browser to access the microphone",
          "return here and tap 'try again'",
        ],
      };
  }
};

export const queryMicPermission = async (): Promise<PermissionState | "unknown"> => {
  try {
    const perms = (navigator as Navigator & { permissions?: { query: (descriptor: { name: PermissionName }) => Promise<PermissionStatus> } }).permissions;
    if (!perms?.query) return "unknown";
    const status = await perms.query({ name: "microphone" as PermissionName });
    return status.state;
  } catch {
    return "unknown";
  }
};
