import { defineConfig, devices } from "@playwright/test";

const liveSiteUrl = process.env.LIVE_SITE_URL;

export default defineConfig({
  testDir: "./tests/live",
  outputDir: "artifacts/live-results",
  timeout: 90000,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "artifacts/live-report" }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: liveSiteUrl ?? "http://127.0.0.1:4321",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: liveSiteUrl
    ? undefined
    : {
        command: "npm run preview",
        url: "http://127.0.0.1:4321",
        reuseExistingServer: false,
        timeout: 30000,
      },
});
