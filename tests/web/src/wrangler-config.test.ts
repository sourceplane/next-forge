import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

// apps/web's wrangler.jsonc is COMMITTED: the composition checks that it
// exists before the build, in a fresh checkout, so it cannot be a file a build
// generates. It is the render of wrangler.template.jsonc from
// wiring.fixture.json, and the stage and prod deploy lanes re-render it from
// their live wiring documents (apps/web/component.yaml's buildCommand).
// These hold the committed file to the template, and the live render to the
// documents it is given.
const app = path.resolve(__dirname, "../../../apps/web");
const wire = path.resolve(__dirname, "../../../tooling/wire");
const COMPONENTS = ["cloudflare-kv"];

const strip = (jsonc: string) =>
  JSON.parse(
    jsonc
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n")
  );

function renderFixture(env: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), "wire-"));
  try {
    const out = path.join(dir, "wrangler.jsonc");
    execFileSync(process.execPath, [
      path.join(wire, "render.mjs"),
      "--template", path.join(app, "wrangler.template.jsonc"),
      "--out", out,
      "--map", path.join(app, "wiring.fixture.json"),
      "--env", env,
    ]);
    return readFileSync(out, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("apps/web wrangler config", () => {
  it("is committed as the fixture render of the template (pnpm run wire:fixture)", () => {
    expect(readFileSync(path.join(app, "wrangler.jsonc"), "utf8")).toBe(
      renderFixture("stage")
    );
  });

  it("keeps every resource in the template a wiring token", () => {
    const template = readFileSync(path.join(app, "wrangler.template.jsonc"), "utf8");
    expect(template).not.toMatch(/"id":\s*"[0-9a-f]{32}"/);
    for (const component of COMPONENTS) {
      expect(template).toContain(`@@wiring(${component}/__ENV__:`);
    }
  });

  it("renders a deploy lane its own environment from the live wiring documents", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "wire-"));
    try {
      const out = path.join(dir, "wrangler.jsonc");
      execFileSync(
        process.execPath,
        [
          path.join(wire, "live.mjs"),
          "--template", path.join(app, "wrangler.template.jsonc"),
          "--out", out,
          "--components", COMPONENTS.join(","),
          "--env", "prod",
        ],
        { env: { ...process.env, ...{
            WIRING_CLOUDFLARE_KV_PROD: JSON.stringify({ app_kv_id: "e".repeat(32), app_kv_title: "prod-x-rate-limit-prod" }),
          } } }
      );
      const rendered = readFileSync(out, "utf8");
      expect(rendered).not.toContain("__ENV__");
      expect(rendered).not.toContain("@@wiring(");
      const config = strip(rendered);
      expect(config.kv_namespaces[0].id).toBe("e".repeat(32));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("refuses a deploy render with no wiring document", () => {
    const env = { ...process.env };
    for (const component of COMPONENTS) {
      delete env[`WIRING_${component.toUpperCase().replace(/-/g, "_")}_STAGE`];
    }
    expect(() =>
      execFileSync(
        process.execPath,
        [
          path.join(wire, "live.mjs"),
          "--template", path.join(app, "wrangler.template.jsonc"),
          "--out", path.join(tmpdir(), "never-written.jsonc"),
          "--components", COMPONENTS.join(","),
          "--env", "stage",
        ],
        { env, stdio: "pipe" }
      )
    ).toThrow();
  });

  it("binds what the app reads", () => {
    const config = strip(readFileSync(path.join(app, "wrangler.jsonc"), "utf8"));
    expect(config.compatibility_flags).toContain("nodejs_compat");
    expect(config.observability).toEqual({ enabled: true });
    expect(config.assets).toEqual({ directory: ".open-next/assets", binding: "ASSETS" });
    expect(config.main).toBe(".open-next/worker.js");
    expect(config.kv_namespaces[0].binding).toBe("RATE_LIMIT");
  });
});
