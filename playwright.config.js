import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.resolve(__dirname, 'Web App', 'FlowAnalytics.html');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    // file:// URL zur gebündelten App
    baseURL: `file://${appPath}`,
    headless: true,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
