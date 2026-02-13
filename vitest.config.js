const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/frontend/**/*.test.js'],
    globals: true,
    testTimeout: 15000,
  },
});
