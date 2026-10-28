import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  globalTeardown: "./tests/teardown.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command:
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/run-backend.ps1 -Ephemeral",
      url: "http://127.0.0.1:8081/api/auth/csrf",
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command:
        "powershell -NoProfile -ExecutionPolicy Bypass -File ../scripts/run-frontend.ps1 -TestServer",
      url: "http://127.0.0.1:5174",
      timeout: 60000,
      reuseExistingServer: false,
    },
  ],
});
