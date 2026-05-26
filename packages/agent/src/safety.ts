import type { BrowserAction, BrowserObservation } from "@chromeclaw/shared";

export type SafetyDecision = "allow" | "confirm" | "block";

export interface SafetyResult {
  decision: SafetyDecision;
  reason?: string;
}

const sensitiveUrlPatterns = [/chrome:\/\//i, /edge:\/\//i, /about:/i, /file:\/\//i, /localhost:\d+\/?(admin|secrets)?/i];
const blockedIntentPatterns = [/bypass.*captcha/i, /solve.*captcha/i, /bypass.*paywall/i, /steal/i, /phishing/i];
const confirmationPatterns = [
  /log ?in|sign ?in|password|credential|2fa|otp/i,
  /checkout|purchase|buy now|subscribe|payment|credit card|bank|trade|transfer/i,
  /send|email|message|post|comment|tweet|publish/i,
  /delete|remove|modify|edit profile|upload|download/i,
  /ssn|passport|private|personal info/i
];

export class SafetyPolicy {
  assess(action: BrowserAction, context: { task: string; observation?: BrowserObservation }): SafetyResult {
    const text = `${context.task} ${context.observation?.url ?? ""} ${context.observation?.title ?? ""} ${JSON.stringify(action)}`;

    if (blockedIntentPatterns.some((pattern) => pattern.test(text))) {
      return { decision: "block", reason: "The requested task appears to bypass a security, CAPTCHA, or access barrier." };
    }

    if (action.type === "navigate" && sensitiveUrlPatterns.some((pattern) => pattern.test(action.url))) {
      return { decision: "block", reason: "Navigation to sensitive browser, file, or local administrative pages is blocked." };
    }

    const isFormOrCommitAction = action.type === "type" || action.type === "click" || action.type === "press";
    if (isFormOrCommitAction && confirmationPatterns.some((pattern) => pattern.test(text))) {
      return { decision: "confirm", reason: "This action may involve credentials, personal data, messaging, purchase, or destructive changes." };
    }

    if (action.type === "search_web" && blockedIntentPatterns.some((pattern) => pattern.test(action.query))) {
      return { decision: "block", reason: "Search query targets a blocked behavior." };
    }

    return { decision: "allow" };
  }
}
