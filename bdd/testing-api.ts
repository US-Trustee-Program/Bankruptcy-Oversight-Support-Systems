import { ApplicationContext } from '../backend/lib/adapters/types/basic';
import { CasesController } from '../backend/lib/controllers/cases/cases.controller';
import { ResponseBody } from '../common/src/api/response';
import { CasesSearchPredicate } from '../common/src/api/search';
import { SyncedCase } from '../common/src/cams/cases';
import { createMockApplicationContext } from '../backend/lib/testing/testing-utilities';
import { toAzureSuccess } from '../backend/function-apps/azure/functions';
import { CamsSession } from '../common/src/cams/session';
import MockData from '../common/src/cams/test-utilities/mock-data';
import { injectApi2 } from '../user-interface/src/lib/models/api2';

async function getMe(): Promise<ResponseBody<CamsSession>> {
  return {
    data: MockData.getCamsSession(),
  };
}
export async function searchCases(
    predicate: CasesSearchPredicate,
    _options: { includeAssignments?: boolean } = {},
  ): Promise<ResponseBody<SyncedCase[]>> {
    const context: ApplicationContext = await createMockApplicationContext({
        request: {
            method: 'POST',
            body: {
                data: predicate,
            },
        }
    });
    const controller = new CasesController(context);
    const response = await controller.handleRequest(context);
    return toAzureSuccess(response) as ResponseBody<SyncedCase[]>;
}

const replacementApi = {
  getMe,
  searchCases,
};

export function initTestingApi(){
    injectApi2(replacementApi);
}
