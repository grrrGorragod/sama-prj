import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
// PostgreSQL detaches from pg_ctl on Windows. Stop it before Playwright kills
// the Java parent, otherwise inherited pipes keep webServer teardown open.
export default async function teardown() {
  const state = JSON.parse(
    fs.readFileSync(path.resolve("../.local/e2e-db.json"), "utf8"),
  );
  const directory = fs.realpathSync(state.dataDirectory);
  const tempRoot = fs.realpathSync(os.tmpdir());
  if (
    !directory
      .toLowerCase()
      .startsWith((tempRoot + path.sep + "sama-e2e-").toLowerCase())
  )
    throw new Error("Refusing to stop an unexpected database");
  const options = fs.readFileSync(
    path.join(directory, "postmaster.opts"),
    "utf8",
  );
  const match = options.match(/^(?:"([^"]+)"|(\S+))/);
  const executable = match?.[1] || match?.[2];
  if (!executable || !path.basename(executable).startsWith("postgres"))
    throw new Error("Test PostgreSQL binary was not found");
  const ctl = path.join(
    path.dirname(executable),
    process.platform === "win32" ? "pg_ctl.exe" : "pg_ctl",
  );
  execFileSync(ctl, ["-D", directory, "-m", "fast", "-w", "stop"], {
    windowsHide: true,
    stdio: "pipe",
    timeout: 15000,
  });
}
