import { TRIAL_ATTORNEYS } from '../../../../common/src/cams/test-utilities/attorneys.mock';
import { createMockApplicationContext } from '../testing/testing-utilities';
import AttorneysList from './attorneys';
import { CaseAssignmentUseCase } from './case-assignment';
import * as factory from '../factory';

describe('Test attorneys use-case', () => {
  const gateway = {
    getAttorneys: jest.fn(),
    getAttorneysByUstpOffice: jest.fn(),
  };

  test('Should use gateway passed to it in constructor', async () => {
    const attorneyUsers = TRIAL_ATTORNEYS;
    jest.spyOn(factory, 'getAttorneyGateway').mockReturnValue(gateway);
    jest.spyOn(gateway, 'getAttorneys').mockResolvedValue(attorneyUsers);

    const mockContext = await createMockApplicationContext();
    const caseList = new AttorneysList();
    const results = await caseList.getAttorneyList(mockContext);

    expect(results).toEqual(attorneyUsers);
  });

  test('should log errors when looking up attorney assignments', async () => {
    const attorneyUsers = TRIAL_ATTORNEYS;
    jest.spyOn(factory, 'getAttorneyGateway').mockReturnValue(gateway);
    jest.spyOn(gateway, 'getAttorneys').mockResolvedValue(attorneyUsers);

    const mockContext = await createMockApplicationContext();
    const loggerSpy = jest.spyOn(mockContext.logger, 'error');

    const assignmentUseCaseSpy = jest
      .spyOn(CaseAssignmentUseCase.prototype, 'getCaseLoad')
      .mockRejectedValue(new Error('TEST'));

    const caseList = new AttorneysList();
    await caseList.getAttorneyList(mockContext);

    expect(assignmentUseCaseSpy).toHaveBeenCalled();
    expect(loggerSpy).toHaveBeenCalled();
  });
});
