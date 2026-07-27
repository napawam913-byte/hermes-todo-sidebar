import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  PlanApiConnectionFileStore, PlanApiConnectionStore,
  type PlanApiConnectionFs, type PlanApiConnectionPersistence, type SecretProtector
} from "./planApiConnectionStore.js";

const input = (overrides = {}) => ({ mode: "local" as const, baseUrl: "http://127.0.0.1:8743/", sshTarget: "", localPort: 8743, remotePort: 8743, desktopToken: "desktop-secret", ...overrides });
const cipher = (token = "old-token") => Buffer.from(`encrypted:${token}`).toString("base64");
const record = (overrides = {}) => ({ schemaVersion: 1 as const, mode: "local" as const, baseUrl: "http://localhost:8743", sshTarget: "", localPort: 8743, remotePort: 8743, tokenCiphertext: cipher(), updatedAt: "2026-07-27T09:00:00.000Z", ...overrides });

function ports(initial: unknown = null, environment: Record<string, string> = {}, packaged = false) {
  let stored = initial; let writes = 0;
  const persistence: PlanApiConnectionPersistence = { load: async () => structuredClone(stored) as never, save: async (value) => { stored = structuredClone(value); writes += 1; } };
  const protector: SecretProtector = { isAvailable: () => true, encrypt: (value) => Buffer.from(`encrypted:${value}`), decrypt: (value) => value.toString().replace("encrypted:", "") };
  return { persistence, protector, writes: () => writes, stored: () => stored, environment: { isPackaged: () => packaged, get: (name: string) => environment[name] } };
}
function fileFs(overrides: Partial<PlanApiConnectionFs>): PlanApiConnectionFs {
  return { mkdir: async () => undefined, readFile: async () => "", writeFile: async () => undefined, rename: async () => undefined, rm: async () => undefined, ...overrides };
}

describe("PlanApiConnectionStore", () => {
  it("stores ciphertext and keeps the previous token when input is blank", async () => {
    const p = ports(); const store = new PlanApiConnectionStore(p.persistence, p.protector);
    await store.save(input()); await store.save(input({ desktopToken: "" }));
    expect(JSON.stringify(p.stored())).not.toContain("desktop-secret");
    await expect(store.resolveConnection()).resolves.toMatchObject({ token: "desktop-secret" });
  });

  it("refuses a first blank token and resolves form input without saving", async () => {
    const p = ports(); const store = new PlanApiConnectionStore(p.persistence, p.protector);
    await expect(store.save(input({ desktopToken: "" }))).rejects.toThrow(/token/i);
    await expect(store.resolveConnection(input({ desktopToken: "form-secret" }))).resolves.toMatchObject({ token: "form-secret" });
    expect(p.writes()).toBe(0);
  });

  it("returns only a token hint and rejects invalid connection input", async () => {
    const p = ports(); const store = new PlanApiConnectionStore(p.persistence, p.protector, () => new Date("2026-07-27T09:00:00Z"));
    await store.save(input({ desktopToken: "abcd-secret" }));
    await expect(store.getPublicConfig()).resolves.toMatchObject({ configured: true, tokenHint: "cret", baseUrl: "http://127.0.0.1:8743" });
    await expect(store.save(input({ mode: "ssh", sshTarget: "" }))).rejects.toThrow(/SSH/);
    await expect(store.save(input({ localPort: 0 }))).rejects.toThrow(/port/i);
    await expect(store.save(input({ baseUrl: "ftp://example.com" }))).rejects.toThrow(/HTTP/);
    await expect(store.save(input({ baseUrl: "https://alice:secret@example.com" }))).rejects.toThrow(/credential/i);
  });

  it("treats malformed and semantic corrupt records as absent without decrypting", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "plan-api-connection-"));
    try {
      await writeFile(path.join(directory, "plan-api-connection.v1.json"), "{");
      await expect(new PlanApiConnectionFileStore(directory).load()).resolves.toBeNull();
    } finally { await rm(directory, { recursive: true, force: true }); }
    for (const invalid of [record({ unexpected: true }), record({ mode: "ssh", sshTarget: "", tokenCiphertext: "not-base64", updatedAt: "now" })]) {
      let decrypted = false; const p = ports(invalid);
      await expect(new PlanApiConnectionStore(p.persistence, { ...p.protector, decrypt: () => { decrypted = true; return "old-token"; } }).resolveConnection()).resolves.toBeNull();
      expect(decrypted).toBe(false);
    }
  });

  it("requires secure storage only for saving or decrypting a valid record", async () => {
    const p = ports(); const unavailable = { ...p.protector, isAvailable: () => false };
    await expect(new PlanApiConnectionStore(p.persistence, unavailable).getPublicConfig()).resolves.toMatchObject({ configured: false });
    await expect(new PlanApiConnectionStore(p.persistence, unavailable).save(input())).rejects.toThrow(/secure storage/i);
    await expect(new PlanApiConnectionStore(ports(record()).persistence, unavailable).resolveConnection()).rejects.toThrow(/secure storage/i);
  });

  it("uses environment only with an explicit development adapter and never persists it", async () => {
    const env = { HERMES_PLAN_API_MODE: "local", HERMES_PLAN_API_URL: "http://localhost:8765/", HERMES_PLAN_API_TOKEN: "environment-secret", HERMES_PLAN_API_SSH_TARGET: "" };
    const p = ports(null, env); const store = new PlanApiConnectionStore(p.persistence, p.protector, undefined, p.environment);
    await expect(store.resolveConnection()).resolves.toMatchObject({ token: "environment-secret", localPort: 8765 });
    expect(p.writes()).toBe(0);
    const previous = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]])); Object.assign(process.env, env);
    try { await expect(new PlanApiConnectionStore(ports().persistence, p.protector).resolveConnection()).resolves.toBeNull(); }
    finally { for (const key of Object.keys(env)) previous[key] === undefined ? delete process.env[key] : process.env[key] = previous[key]; }
  });

  it("propagates read I/O failures and cleans a unique temp after write failure", async () => {
    const readError = Object.assign(new Error("denied"), { code: "EACCES" });
    await expect(new PlanApiConnectionFileStore("data", fileFs({ readFile: async () => { throw readError; } })).load()).rejects.toBe(readError);
    const removed: string[] = []; const writeError = new Error("write");
    const store = new PlanApiConnectionFileStore("data", fileFs({ writeFile: async () => { throw writeError; }, rm: async (name) => { removed.push(name); } }));
    await expect(store.save(record())).rejects.toBe(writeError);
    expect(removed).toHaveLength(1); expect(removed[0]).toContain(".tmp");
  });

  it("preserves rename failure when cleanup also fails", async () => {
    const primary = new Error("rename"); const cleanup = new Error("cleanup");
    const store = new PlanApiConnectionFileStore("data", fileFs({ rename: async () => { throw primary; }, rm: async () => { throw cleanup; } }));
    await expect(store.save(record())).rejects.toBe(primary);
  });

  it("atomically replaces encrypted files and removes temporary files", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "plan-api-connection-"));
    try {
      const store = new PlanApiConnectionStore(new PlanApiConnectionFileStore(directory), ports().protector);
      await store.save(input()); await store.save(input({ desktopToken: "replacement-secret" }));
      const saved = await readFile(path.join(directory, "plan-api-connection.v1.json"), "utf8");
      expect(saved).not.toContain("replacement-secret");
      expect((await readdir(directory)).filter((name) => name.includes(".tmp"))).toEqual([]);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("serializes saves and recovers its queue after a failed save", async () => {
    const p = ports(record()); let release!: () => void; let delayed = true; let fail = false;
    const persistence: PlanApiConnectionPersistence = {
      load: async () => { const snapshot = structuredClone(p.stored()) as never; if (delayed) { delayed = false; await new Promise<void>((resolve) => { release = resolve; }); } return snapshot; },
      save: async (value) => { if (fail) throw new Error("save failed"); await p.persistence.save(value); }
    };
    const store = new PlanApiConnectionStore(persistence, p.protector);
    const blank = store.save(input({ baseUrl: "http://old.example:8743", desktopToken: "" }));
    await Promise.resolve();
    const fresh = store.save(input({ baseUrl: "http://new.example:8743", desktopToken: "new-token" }));
    release(); await Promise.all([blank, fresh]);
    await expect(store.resolveConnection()).resolves.toMatchObject({ baseUrl: "http://new.example:8743", token: "new-token" });
    fail = true; await expect(store.save(input())).rejects.toThrow("save failed"); fail = false;
    await expect(store.save(input({ desktopToken: "after-failure" }))).resolves.toMatchObject({ tokenHint: "lure" });
  });
});
