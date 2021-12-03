export type GetOptions = {
  strategy: GetStrategy;
};
export type GetLinksOptions = {};

export enum GetStrategy {
  Latest,
  Contents,
}

export interface QueryFilter {}
