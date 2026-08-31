const { defineConfig } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

const appURL = pathToFileURL(path.resolve(__dirname, '../todo.html')).href + '?test';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 15000,
  workers: 1,
  use: {
    baseURL: appURL,
    channel: 'chrome',
    headless: false,
    viewport: { width: 800, height: 600 },
    launchOptions: {
      args: ['--window-position=9999,9999', '--window-size=800,600'],
    },
  },
});
