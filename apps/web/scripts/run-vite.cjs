const { spawnSync } = require("child_process");
const path = require("path");

const polyfill = path.join(__dirname, "../crypto-polyfill.cjs");
const viteBin = path.join(path.dirname(require.resolve("vite/package.json")), "bin/vite.js");
const result = spawnSync(process.execPath, ["-r", polyfill, viteBin, ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
