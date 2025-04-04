import MigrateOfficeAssigneesUseCase from './migrate-office-assignees';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MockOfficesGateway } from '../../testing/mock-gateways/mock.offices.gateway';
import { MOCKED_USTP_OFFICES_ARRAY } from '../../../../common/src/cams/offices';

describe('office-assignees use case tests', () => {
  test('should migrate existing assignments', async () => {
    const court = MOCKED_USTP_OFFICES_ARRAY[0];
    const cases = MockData.buildArray(
      () =>
        MockData.getSyncedCase({
          override: { courtDivisionCode: court.groups[0].divisions[0].divisionCode },
        }),
      5,
    );
    cases[0].closedDate = '2020-01-01';

    const assignments = cases.map((bCase) => {
      return MockData.getAttorneyAssignment({ caseId: bCase.caseId });
    });
    const assignmentsSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getAllActiveAssignments')
      .mockResolvedValue(assignments);

    jest
      .spyOn(MockOfficesGateway.prototype, 'getOffices')
      .mockResolvedValue(MOCKED_USTP_OFFICES_ARRAY);

    const caseSpy = jest
      .spyOn(MockMongoRepository.prototype, 'getSyncedCase')
      .mockImplementation((caseId: string) =>
        Promise.resolve(cases.find((bCase) => bCase.caseId === caseId)),
      );

    const createSpy = jest.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue({});

    const context: ApplicationContext = await createMockApplicationContext();
    await MigrateOfficeAssigneesUseCase.migrateAssignments(context);

    expect(assignmentsSpy).toHaveBeenCalled();
    expect(caseSpy).toHaveBeenCalledTimes(cases.length);
    expect(createSpy).toHaveBeenCalledTimes(cases.length - 1);
  });
});
