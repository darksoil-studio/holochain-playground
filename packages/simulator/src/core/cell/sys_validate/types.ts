import { DepsMissing } from '../workflows/sys_validation';

export type ValidationOutcome =
  | {
      resolved: true;
      valid: boolean;
    }
  | ({
      resolved: false;
    } & DepsMissing);
