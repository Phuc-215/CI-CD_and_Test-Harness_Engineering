import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  reporter: process.env.CI
    ? [['list'], ['junit', { outputFile: process.env.PLAYWRIGHT_JUNIT_OUTPUT_FILE || '../reports/playwright.xml' }]]
    : 'list',
  use: {
    baseURL: 'http://localhost:5174',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
  },
});
