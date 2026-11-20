import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../configs/axios", () => ({ default: {}, fetcherGet: vi.fn(), fetcherPost: vi.fn() }));

const storage = new Map<string, string>();
const fakeStorage = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
};
const listeners: Record<string, ((event: unknown) => void)[]> = {};
vi.stubGlobal("window", {
  localStorage: fakeStorage,
  sessionStorage: fakeStorage,
  location: { href: "" },
  addEventListener: (name: string, fn: (event: unknown) => void) => (listeners[name] ||= []).push(fn),
  removeEventListener: () => undefined,
});

const { afterRefusedRefresh, announceSignedOut, endsSignIn, loginNotice, loginRedirect } = await import("./signOut");
const { onLockEvent } = await import("./autoLock");
const { useKeyStore } = await import("../store/keyStore");
const { useNoteStore } = await import("../store/noteStore");

beforeEach(() => storage.clear());

describe("F18: signing out leaves no open tab", () => {
  it("announces the sign-out to the other tabs", () => {
    announceSignedOut();
    expect(storage.get("keevo.lockEvent")).toMatch(/^signedOut:\d+$/);
  });

  it("another tab signed out: this one forgets the open vault and leaves", () => {
    useKeyStore.setState({ keys: { userKey: new Uint8Array(32), privateKey: new Uint8Array(32), publicKey: "p" } } as never);
    useNoteStore.setState({ notes: [{ id: 1 }] } as never);
    const leave = vi.fn();
    onLockEvent("signedOut:123", leave);
    expect(useKeyStore.getState().keys).toBeNull();
    expect(useNoteStore.getState().notes).toEqual([]);
    expect(leave).toHaveBeenCalled();
  });

  it("a lock event still only locks", () => {
    const leave = vi.fn();
    onLockEvent("locked:123", leave);
    expect(leave).not.toHaveBeenCalled();
  });
});

describe("F18: being signed out after 12 hours away", () => {
  it("the sign-in page says why", () => {
    expect(loginNotice("idle")).toBe("You were signed out after 12 hours without using 2keevo. Sign in again to continue.");
    expect(loginNotice(null)).toBeNull();
    expect(loginNotice("other")).toBeNull();
  });

  it("the way back to sign-in keeps the page and says why", () => {
    expect(loginRedirect("/keevo/items", "?c=2", "idle_signed_out")).toBe(
      `/auth/login?next=${encodeURIComponent("/keevo/items?c=2")}&ended=idle`
    );
    expect(loginRedirect("/keevo", "", "token_reused")).toBe(`/auth/login?next=${encodeURIComponent("/keevo")}`);
    expect(loginRedirect("/settings", "", "idle_signed_out")).toBe("/auth/login?ended=idle");
    expect(loginRedirect("/auth/register", "", undefined)).toBeNull();
  });
});

describe("F18 review fixes", () => {
  it("only a refused refresh signs out; offline or a server error doesn't", () => {
    expect(endsSignIn({ response: { status: 401 } })).toBe(true);
    expect(endsSignIn({ message: "Network Error" })).toBe(false);
    expect(endsSignIn({ response: { status: 502 } })).toBe(false);
  });

  it("any page of the app forgets the open keys when another tab signs out", () => {
    useKeyStore.setState({ keys: { userKey: new Uint8Array(32), privateKey: new Uint8Array(32), publicKey: "p" } } as never);
    (listeners.storage || []).forEach((fn) => fn({ key: "keevo.lockEvent", newValue: "signedOut:5" }));
    expect(useKeyStore.getState().keys).toBeNull();
  });
});

describe("F18 final review fixes", () => {
  it("a refused refresh on a sign-in page still forgets that tab's keys and tells the others", () => {
    useKeyStore.setState({ keys: { userKey: new Uint8Array(32), privateKey: new Uint8Array(32), publicKey: "p" } } as never);
    const go = vi.fn();
    afterRefusedRefresh("/auth/recovery-key", "", undefined, go);
    expect(useKeyStore.getState().keys).toBeNull();
    expect(storage.get("keevo.lockEvent")).toMatch(/^signedOut:/);
    expect(go).not.toHaveBeenCalled();
  });

  it("elsewhere it also goes to sign-in", () => {
    const go = vi.fn();
    afterRefusedRefresh("/settings", "", "idle_signed_out", go);
    expect(go).toHaveBeenCalledWith("/auth/login?ended=idle");
  });
});
