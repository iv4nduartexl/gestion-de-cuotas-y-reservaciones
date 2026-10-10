import { execFileSync } from "node:child_process";

export default function globalSetup() {
  execFileSync(process.execPath, ["scripts/setup-test-db.mjs", "--reset"], {
    stdio: "inherit",
  });
}
