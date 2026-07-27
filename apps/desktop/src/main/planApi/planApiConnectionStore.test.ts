import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  PlanApiConnectionFileStore,
  PlanApiConnectionStore,
  type PlanApiConnectionPersistence,
  type SecretProtector
} from "./planApiConnectionStore.js";

const input = (overrides = {}) => ({
  mode: "local" as const, baseUrl: "http://127.0.0.1:8743/", sshTarget: "",
  localPort: 8743, remotePort: 8743, desktopToken: "desktop-secret", ...overrides
});

function ports(initial: Record<string, unknown> | null = null, environment: Record<string, string> = {}, packaged = false) {
  let stored = initial;
  let writes = 0;
  const persistence: PlanApiConnectionPersistence = {
    load: async () => structuredClone(stored),
    save: async (value) => { stored = structuredClone(value); writes += 1; }
  };
  const protector: SecretProtector = {
    isAvailable: () => true,
    encrypt: (value) => Buffer.from(`encrypted:${value}`, "utf8"),
    decrypt: (value) => value.toString("utf8").replace("encrypted:", "")
  };
  return {
    persistence, protector, writes: () => writes, stored: () => stored,
    environment: { isPackaged: () => packaged, get: (name: string) => environment[name] }
  };
}

describe("PlanApiConnectionStore", () => {
  it("stores ciphertext and keeps the previous token when input is blank", async () => {
    const p = ports();
    const store = new PlanApiConnectionStore(p.persistence, p.protector);
    await store.save(input());
    await store.save(input({ desktopToken: "" }));
    expect(JSON.stringify(p.stored())).not.toContain("desktop-secret");
    await expect(store.resolveConnection()).resolves.toMatchObject({ token: "desktop-secret" });
  });

  it("refuses a blank token for the first configuration", async () => {
    const p = ports();
    await expect(new PlanApiConnectionStore(p.persistence, p.protector).save(input({ desktopToken: "" })))
      .rejects.toThrow(/token/i);
  });

  it("returns a public snapshot with only the final four token characters", async () => {
    const p = ports();
    const store = new PlanApiConnectionStore(p.persistence, p.protector, () => new Date("2026-07-27T09:00:00Z"));
    await store.save(input({ desktopToken: "abcd-secret" }));
    await expect(store.getPublicConfig()).resolves.toEqual({
      schemaVersion: 1, configured: true, mode: "local", baseUrl: "http://127.0.0.1:8743",
      sshTarget: "", localPort: 8743, remotePort: 8743, tokenConfigured: true,
      tokenHint: "cret", updatedAt: "2026-07-27T09:00:00.000Z"
    });
  });

  it("rejects invalid SSH targets, ports, and Base URLs", async () => {
    const p = ports();
    const store = new PlanApiConnectionStore(p.persistence, p.protector);
    await expect(store.save(input({ mode: "ssh", sshTarget: "" }))).rejects.toThrow(/SSH/);
    await expect(store.save(input({ localPort: 0 }))).rejects.toThrow(/port/i);
    await expect(store.save(input({ baseUrl: "ftp://example.com" }))).rejects.toThrow(/HTTP/);
  });

  it("strictly rejects malformed persisted JSON", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "plan-api-connection-"));
    try {
      await writeFile(path.join(directory, "plan-api-connection.v1.json"), JSON.stringify({
        schemaVersion: 1, mode: "local", baseUrl: "http://localhost", sshTarget: "", localPort: 1,
        remotePort: 1, tokenCiphertext: "x", updatedAt: "now", unexpected: true
      }));
      await expect(new PlanApiConnectionFileStore(directory).load()).resolves.toBeNull();
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it("fails on unavailable encryption only when a token must be saved or decrypted", async () => {
    const empty = ports();
    const unavailable = { ...empty.protector, isAvailable: () => false };
    const noConfig = new PlanApiConnectionStore(empty.persistence, unavailable);
    await expect(noConfig.getPublicConfig()).resolves.toMatchObject({ configured: false });
    await expect(noConfig.save(input())).rejects.toThrow(/secure storage/i);
    const seeded = ports({ schemaVersion: 1, mode: "local", baseUrl: "http://localhost", sshTarget: "", localPort: 1, remotePort: 1, tokenCiphertext: Buffer.from("encrypted:x").toString("base64"), updatedAt: "now" });
    await expect(new PlanApiConnectionStore(seeded.persistence, unavailable).resolveConnection()).rejects.toThrow(/secure storage/i);
  });

  it("uses development environment configuration without writing it to disk", async () => {
    const p = ports(null, {
      HERMES_PLAN_API_MODE: "local", HERMES_PLAN_API_URL: "http://localhost:8765/",
      HERMES_PLAN_API_TOKEN: "environment-secret", HERMES_PLAN_API_SSH_TARGET: ""
    });
    const store = new PlanApiConnectionStore(p.persistence, p.protector, undefined, p.environment);
    await expect(store.resolveConnection()).resolves.toMatchObject({ baseUrl: "http://localhost:8765", localPort: 8765, remotePort: 8765, token: "environment-secret" });
    await expect(store.getPublicConfig()).resolves.toMatchObject({ configured: true, tokenHint: "cret" });
    expect(p.writes()).toBe(0);
  });

  it("ignores environment configuration in packaged mode", async () => {
    const p = ports(null, { HERMES_PLAN_API_MODE: "local", HERMES_PLAN_API_URL: "http://localhost:8743", HERMES_PLAN_API_TOKEN: "secret" }, true);
    const store = new PlanApiConnectionStore(p.persistence, p.protector, undefined, p.environment);
    await expect(store.resolveConnection()).resolves.toBeNull();
    await expect(store.getPublicConfig()).resolves.toMatchObject({ configured: false });
  });

  it("resolves the current form without persisting it", async () => {
    const p = ports();
    const store = new PlanApiConnectionStore(p.persistence, p.protector);
    await expect(store.resolveConnection(input({ desktopToken: "form-secret" }))).resolves.toMatchObject({ token: "form-secret" });
    expect(p.writes()).toBe(0);
  });

  it("atomically replaces the encrypted file and removes unique temporary files", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "plan-api-connection-"));
    try {
      const fileStore = new PlanApiConnectionFileStore(directory);
      const store = new PlanApiConnectionStore(fileStore, ports().protector);
      await store.save(input());
      await store.save(input({ desktopToken: "replacement-secret" }));
      const saved = await readFile(path.join(directory, "plan-api-connection.v1.json"), "utf8");
      expect(saved).not.toContain("desktop-secret");
      expect(saved).not.toContain("replacement-secret");
      await expect(store.resolveConnection()).resolves.toMatchObject({ token: "replacement-secret" });
      expect((await readdir(directory)).filter((name) => name.includes(".tmp"))).toEqual([]);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
