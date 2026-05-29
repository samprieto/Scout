import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "proj_rifuoyuyipwldfvkxtsu",
  runtime: "node",
  logLevel: "log",
  maxDuration: 86400,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 1 },
  },
  dirs: ["./trigger"],
});
