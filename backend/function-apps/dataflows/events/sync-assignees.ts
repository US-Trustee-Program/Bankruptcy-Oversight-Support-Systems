import { app } from '@azure/functions';
import { SYNC_ASSIGNEES } from '../queue';

const MODULE_NAME = SYNC_ASSIGNEES;

function setup() {
  app.storageQueue('start', {
    connection: 'start-connection',
    queueName: 'start-queue',
    handler: async () => {},
    extraOutputs: [],
  });
}

export default {
  MODULE_NAME,
  setup,
};
