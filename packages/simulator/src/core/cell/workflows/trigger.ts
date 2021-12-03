import { app_validation_task } from './app_validation';
import { integrate_dht_ops_task } from './integrate_dht_ops';
import { produce_dht_ops_task } from './produce_dht_ops';
import { publish_dht_ops_task } from './publish_dht_ops';
import { sys_validation_task } from './sys_validation';
import { validation_receipt_task } from './validation_receipt';
import { Workflow, WorkflowType } from './workflows';

export function triggeredWorkflowFromType(
  type: WorkflowType
): Workflow<any, any> {
  switch (type) {
    case WorkflowType.APP_VALIDATION:
      return app_validation_task();
    case WorkflowType.INTEGRATE_DHT_OPS:
      return integrate_dht_ops_task();
    case WorkflowType.PRODUCE_DHT_OPS:
      return produce_dht_ops_task();
    case WorkflowType.PUBLISH_DHT_OPS:
      return publish_dht_ops_task();
    case WorkflowType.SYS_VALIDATION:
      return sys_validation_task();
    case WorkflowType.VALIDATION_RECEIPT:
      return validation_receipt_task();
    default:
      throw new Error('Trying to trigger a workflow that cannot be triggered');
  }
}
