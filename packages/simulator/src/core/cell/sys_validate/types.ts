import { DepsMissing } from '../workflows/sys_validation.js';

export type ValidationOutcome =
  | {
      resolved: true;
      valid: boolean;
    }
  | ({
      resolved: false;
    } & DepsMissing);
