import CasesDxtrGateway from './cases.dxtr.gateway';
import { applicationContextCreator } from '../utils/application-context-creator';

const context = require('azure-function-context-mock');
const appContext = applicationContextCreator(context);

describe('Test DXTR Gateway', () => {
  test('returns a non empty list of chapter 15 cases when requested', async () => {
    const testCasesDxtrGateway: CasesDxtrGateway = new CasesDxtrGateway();
    const actualResult = await testCasesDxtrGateway.getChapter15Cases(appContext, {});
    console.log(actualResult);
    expect(actualResult).not.toEqual([]);
  });
});
