import { Dictionary } from '@holochain-open-dev/core-types';
import { Task } from './task';

export type Middleware<P> = (payload: P) => Promise<void>;
export type SuccessMiddleware<P> = (payload: P, result: any) => Promise<void>;
export type ErrorMiddleware<P> = (payload: P, error: any) => Promise<void>;
export type MiddlewareSubscription = { unsubscribe: () => void };

export class MiddlewareExecutor<P> {
  _beforeMiddlewares: Dictionary<Array<Middleware<P>>> = {};
  _successMiddlewares: Dictionary<Array<SuccessMiddleware<P>>> = {};
  _errorMiddlewares: Dictionary<Array<ErrorMiddleware<P>>> = {};

  async execute<T>(task: Task<T>, payload: P): Promise<T> {
    for (const middleware of this.toArray(this._beforeMiddlewares)) {
      await middleware(payload);
    }

    try {
      const result = await task();

      for (const middleware of this.toArray(this._successMiddlewares)) {
        await middleware(payload, result);
      }

      return result;
    } catch (e) {
      for (const middleware of this.toArray(this._errorMiddlewares)) {
        await middleware(payload, e);
      }

      throw e;
    }
  }

  toArray<T>(middlewares: Dictionary<Array<T>>): Array<T> {
    const keys = Object.keys(middlewares);

    let orderedMiddlewares: Array<T> = [];

    for (const key of keys.sort()) {
      if (middlewares[key]) {
        orderedMiddlewares = orderedMiddlewares.concat(middlewares[key]);
      }
    }
    return orderedMiddlewares;
  }

  before(
    callback: Middleware<P>,
    priorityLevel?: number
  ): MiddlewareSubscription {
    return this._addListener(callback, this._beforeMiddlewares, priorityLevel);
  }
  success(
    callback: SuccessMiddleware<P>,
    priorityLevel?: number
  ): MiddlewareSubscription {
    return this._addListener(callback, this._successMiddlewares, priorityLevel);
  }

  error(
    callback: ErrorMiddleware<P>,
    priorityLevel?: number
  ): MiddlewareSubscription {
    return this._addListener(callback, this._errorMiddlewares, priorityLevel);
  }

  private _addListener(
    callback: Function,
    middlewareList: Dictionary<Array<Function>>,
    priorityLevel: number = 10
  ) {
    if (!middlewareList[priorityLevel]) {
      middlewareList[priorityLevel] = [];
    }

    middlewareList[priorityLevel].unshift(callback);

    return {
      unsubscribe: () => {
        const index = middlewareList[priorityLevel].findIndex(
          c => c === callback
        );
        middlewareList[priorityLevel].splice(index, 1);
      },
    };
  }
}
