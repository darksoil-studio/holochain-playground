import { Middleware } from './middleware-executor';

export const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(() => resolve(), ms));

export const DelayMiddleware = (ms: number): Middleware<any> => () => sleep(ms);
