const { spawnSync } = require("child_process");
const path = require("path");
let esbuild;
try {
  esbuild = require("esbuild");
} catch {
  esbuild = require(path.join(__dirname, "../../../node_modules/esbuild"));
}

const root = path.join(__dirname, "..");
const outfile = path.join(root, "dist", "server.cjs");

esbuild.buildSync({
  absWorkingDir: root,
  entryPoints: [path.join(root, "src", "index.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node16",
  sourcemap: true,
  external: ["better-sqlite3"],
  alias: {
    "@arrowflow/engine": path.join(root, "../../packages/engine/src/index.ts"),
    "@arrowflow/levels": path.join(root, "../../packages/levels/src/index.ts"),
  },
});

const result = spawnSync(process.execPath, [outfile, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: root,
  env: {
    ...process.env,
    ARROWFLOW_SQLITE: process.env.ARROWFLOW_SQLITE || path.join(root, "data", "arrowflow.sqlite"),
  },
});
process.exit(result.status ?? 1);
