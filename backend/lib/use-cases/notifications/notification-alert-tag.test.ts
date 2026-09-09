import * as fs from 'fs';
import * as path from 'path';
import { NOTIFICATION_SEND_FAILURE_TAG } from './notification-alert-tag';

describe('NOTIFICATION_SEND_FAILURE_TAG', () => {
  test('stays in sync with the acsSendFailureAlert KQL in main.bicep', () => {
    const bicepPath = path.join(__dirname, '../../../../ops/cloud-deployment/main.bicep');
    const bicepContents = fs.readFileSync(bicepPath, 'utf-8');

    expect(bicepContents).toContain(NOTIFICATION_SEND_FAILURE_TAG);
  });
});
