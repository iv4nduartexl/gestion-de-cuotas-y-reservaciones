import { execFileSync } from "node:child_process";

export default function setup() {
  execFileSync(process.execPath, ["scripts/setup-test-db.mjs", "--reset"], {
    stdio: "inherit",
  });
}
