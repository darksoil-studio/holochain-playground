import { CellId } from '@holochain/client';

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
