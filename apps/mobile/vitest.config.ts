import { defineConfig } from 'vitest/config';

// Unit tests cover pure logic and the data layer (Dexie via fake-indexeddb), so a plain Node
// environment is enough; rendering is checked on the phone and in the browser.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
