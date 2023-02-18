import { Middleware } from './middleware-executor.js';

export const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(() => resolve(), ms));

export const DelayMiddleware = (ms: number): Middleware<any> => () => sleep(ms);
