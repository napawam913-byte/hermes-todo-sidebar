import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const aiDirectory = path.dirname(fileURLToPath(import.meta.url));

describe("AI SSH runtime wiring", () => {
  it("wraps model requests with the managed Hermes SSH transport", () => {
    const source = readFileSync(
      path.resolve(aiDirectory, "aiBootstrap.ts"),
      "utf8"
    );

    expect(source).toContain("new AiSshTransport");
    expect(source).toContain("new SshAwareModelClient");
    expect(source).toContain("resolvePlanApiConfig");
    expect(source).toContain("transport.stop()");
  });

  it("reuses the saved Plan API SSH target without exposing its token", () => {
    const mainSource = readFileSync(
      path.resolve(aiDirectory, "../main.ts"),
      "utf8"
    );
    const planSource = readFileSync(
      path.resolve(aiDirectory, "../planApi/planApiBootstrap.ts"),
      "utf8"
    );

    expect(mainSource).toContain(
      "resolvePlanApiConfig: () => runtime.getPublicConfig()"
    );
    expect(planSource).toContain(
      "getPublicConfig: () => connections.getPublicConfig()"
    );
    expect(mainSource).not.toContain("resolveConnection()");
  });
});
