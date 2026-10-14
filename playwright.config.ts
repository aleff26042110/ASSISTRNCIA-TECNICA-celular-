import { defineConfig } from "@playwright/test";

const executablePath = process.env.CHROMIUM_PATH;
const softwareWebGL = process.env.CELLVISION_SOFTWARE_WEBGL === "1" || process.platform !== "win32";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: [
        ...(softwareWebGL ? ["--use-gl=angle", "--use-angle=swiftshader"] : []),
        "--enable-unsafe-swiftshader",
      ],
    },
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
