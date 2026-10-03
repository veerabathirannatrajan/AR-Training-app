import { defineConfig } from 'vitest/config';

// Unit tests cover pure logic and the data layer (Dexie via fake-indexeddb), so a plain Node
// environment is enough; rendering is checked on the phone and in the browser.
export default defineConfig({
  define: {
    __ARMT_CERT_KEYS__: '[]',
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
