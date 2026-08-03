import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
  },
  webServer: {
    command: 'python3 -m http.server 4173 --directory build',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
});
