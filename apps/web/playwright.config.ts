import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(currentDir, '../..');
const apiTempDir = resolve(repoRoot, 'apps/api/.tmp/playwright');
const webTempDir = resolve(repoRoot, 'apps/web/.next-playwright');

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `cd ${repoRoot} && rm -rf ${apiTempDir} && mkdir -p ${apiTempDir} && pnpm --filter @worknext/api build && API_PORT=3101 STORAGE_DRIVER=local LOCAL_DATA_FILE=${resolve(apiTempDir, 'state.json')} LOCAL_UPLOAD_DIR=${resolve(apiTempDir, 'uploads')} JWT_ACCESS_SECRET=test-access-secret JWT_REFRESH_SECRET=test-refresh-secret CORS_ORIGIN=http://127.0.0.1:3100 pnpm --filter @worknext/api start`,
      url: 'http://127.0.0.1:3101/api/health',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `cd ${repoRoot} && rm -rf ${webTempDir} && PORT=3100 NEXT_DIST_DIR=.next-playwright NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3101/api pnpm --filter @worknext/web dev`,
      url: 'http://127.0.0.1:3100',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});