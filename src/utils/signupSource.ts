/**
 * Where a new account came from: the first visit's UTM tags, referrer and landing page.
 * The website (2keevo.com) stores them in a first-party cookie shared with app.2keevo.com;
 * sign-up sends them along. Same logic as notes_web/lib/signupSource.ts — keep them in step.
 */
export const SOURCE_COOKIE = "keevo_src";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const OWN_DOMAIN = /(^|\.)2keevo\.com$/;

export interface SignupSourceInput {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  referrerDomain?: string;
  landingPath?: string;
}

const UTM = { source: "utm_source", medium: "utm_medium", campaign: "utm_campaign", content: "utm_content" } as const;

function referrerDomainOf(referrer: string): string | undefined {
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    return host && !OWN_DOMAIN.test(host) && host !== "localhost" ? host : undefined;
  } catch {
    return undefined;
  }
}

/** The source this page view carries, or null when it carries none (no tags, no outside referrer). */
export function sourceFromVisit(href: string, referrer: string): SignupSourceInput | null {
  const url = new URL(href);
  const out: SignupSourceInput = {};
  for (const [key, param] of Object.entries(UTM) as [keyof typeof UTM, string][]) {
    const value = url.searchParams.get(param)?.trim();
    if (value) out[key] = value.slice(0, 150);
  }
  const referrerDomain = referrerDomainOf(referrer);
  if (referrerDomain) out.referrerDomain = referrerDomain;
  if (Object.keys(out).length === 0) return null;
  out.landingPath = url.pathname.slice(0, 255);
  return out;
}

export function encodeSource(source: SignupSourceInput): string {
  return encodeURIComponent(JSON.stringify(source));
}

export function decodeSource(value: string | undefined): SignupSourceInput | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

/** Saves this visit's source unless an earlier one is already remembered (first visit wins). */
export function rememberVisitSource() {
  try {
    if (readCookie(SOURCE_COOKIE)) return;
    const source = sourceFromVisit(window.location.href, document.referrer);
    if (!source) return;
    const domain = OWN_DOMAIN.test(window.location.hostname) ? "; domain=.2keevo.com" : "";
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${SOURCE_COOKIE}=${encodeSource(source)}; max-age=${MAX_AGE_SECONDS}; path=/; samesite=lax${domain}${secure}`;
  } catch {
    // Attribution is best effort; never break the page over it.
  }
}

/** The remembered source to send with sign-up, if any. */
export function signupSource(): SignupSourceInput | null {
  try {
    return decodeSource(readCookie(SOURCE_COOKIE));
  } catch {
    return null;
  }
}
