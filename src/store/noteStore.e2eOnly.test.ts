import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock("../configs/axios", () => ({ default: http, fetcherGet: vi.fn(), fetcherPost: vi.fn() }));

import { useAuthStore } from "./authStore";
import { useKeyStore } from "./keyStore";
import { useNoteStore } from "./noteStore";

const UNLOCK = "Unlock your vault and try again.";

beforeEach(() => {
  vi.clearAllMocks();
  // Signed in, but the vault is locked: no keys open.
  useAuthStore.setState({ me: { id: 1, e2eEnabled: true } } as never);
  useKeyStore.setState({ keys: null } as never);
});

describe("stage 10.6: a locked vault never sends a readable item", () => {
  it("creating an item asks to unlock and sends nothing", async () => {
    await expect(useNoteStore.getState().createNote({ title: "Bank", category: "password" } as never)).rejects.toThrow(UNLOCK);
    expect(http.post).not.toHaveBeenCalled();
  });

  it("saving changes asks to unlock and sends nothing", async () => {
    await expect(useNoteStore.getState().updateNote(5, { title: "Bank 2" } as never)).rejects.toThrow(UNLOCK);
    expect(http.put).not.toHaveBeenCalled();
  });

  it("importing asks to unlock and sends nothing", async () => {
    await expect(useNoteStore.getState().importNotes([{ title: "Bank" }] as never)).rejects.toThrow(UNLOCK);
    expect(http.post).not.toHaveBeenCalled();
  });

  it("creating a collection asks to unlock and sends nothing", async () => {
    await expect(useNoteStore.getState().createCollection("Work")).rejects.toThrow(UNLOCK);
    expect(http.post).not.toHaveBeenCalled();
  });
});
