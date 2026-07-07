const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 15000,
  workers: 1,
  use: {
    baseURL: 'file:///Users/cindyz/todo.html?test',
    channel: 'chrome',
    headless: false,
    viewport: { width: 800, height: 600 },
    launchOptions: {
      args: ['--window-position=9999,9999', '--window-size=800,600'],
    },
  },
});
