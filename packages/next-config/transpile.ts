import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Every workspace package under packages/, by name. The apps build with
// webpack (the smaller Worker), which compiles only the app's own files: the
// `@repo/*` packages are TypeScript sources outside it, so each app lists
// them as `transpilePackages`. Upstream built with Turbopack, which did this
// by itself.
export const workspacePackages = (appDir: string): string[] => {
  const root = path.join(appDir, "../../packages");
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        const manifest = JSON.parse(
          readFileSync(path.join(root, entry.name, "package.json"), "utf8")
        ) as { name?: string };
        return manifest.name ? [manifest.name] : [];
      } catch {
        return [];
      }
    });
};
