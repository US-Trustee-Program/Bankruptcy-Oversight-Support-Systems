const { defineConfig } = require('vitest/config');
const path = require('path');

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: path.resolve(__dirname),
    include: ['__tests__/**/*.test.js'],
  },
});
