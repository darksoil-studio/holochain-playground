import { CellId } from '@holochain/conductor-api';

export interface ZomeFunctionResult {
  cellId: CellId;
  zome: string;
  fnName: string;
  payload: any;
  timestamp: number;
  result:
    | undefined
    | {
        success: boolean;
        payload: any;
      };
}
