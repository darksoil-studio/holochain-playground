import { puppeteerLauncher } from '@web/test-runner-puppeteer';

const files = ['test/**/*.test.js'];

const debug = !!process.env.DEBUG;

export default {
  files,
  manual: debug,
  open: debug,
  nodeResolve: {
    browser: true,
  },
  browsers: [
    puppeteerLauncher({
      launchOptions: {
        args: ['--no-sandbox'],
      },
    }),
  ],
};
