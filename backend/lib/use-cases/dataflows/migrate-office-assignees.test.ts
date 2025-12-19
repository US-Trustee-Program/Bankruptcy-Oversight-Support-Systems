import { vi } from 'vitest';
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
    const assignmentsSpy = vi
      .spyOn(MockMongoRepository.prototype, 'getAllActiveAssignments')
      .mockResolvedValue(assignments);

    vi.spyOn(MockOfficesGateway.prototype, 'getOffices').mockResolvedValue(
      MOCKED_USTP_OFFICES_ARRAY,
    );

    const caseSpy = vi
      .spyOn(MockMongoRepository.prototype, 'getSyncedCase')
      .mockImplementation((caseId: string) =>
        Promise.resolve(cases.find((bCase) => bCase.caseId === caseId)),
      );

    const createSpy = vi.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue({});

    const context: ApplicationContext = await createMockApplicationContext();
    await MigrateOfficeAssigneesUseCase.migrateAssignments(context);

    expect(assignmentsSpy).toHaveBeenCalled();
    expect(caseSpy).toHaveBeenCalledTimes(cases.length);
    expect(createSpy).toHaveBeenCalledTimes(cases.length - 1);
  });

  test('should handle cases where case is not found', async () => {
    const court = MOCKED_USTP_OFFICES_ARRAY[0];
    const cases = MockData.buildArray(
      () =>
        MockData.getSyncedCase({
          override: { courtDivisionCode: court.groups[0].divisions[0].divisionCode },
        }),
      2,
    );

    const assignments = cases.map((bCase) => {
      return MockData.getAttorneyAssignment({ caseId: bCase.caseId });
    });
    // Add an assignment for a non-existent case
    assignments.push(MockData.getAttorneyAssignment({ caseId: 'non-existent-case' }));

    vi.spyOn(MockMongoRepository.prototype, 'getAllActiveAssignments').mockResolvedValue(
      assignments,
    );

    vi.spyOn(MockOfficesGateway.prototype, 'getOffices').mockResolvedValue(
      MOCKED_USTP_OFFICES_ARRAY,
    );

    const caseSpy = vi
      .spyOn(MockMongoRepository.prototype, 'getSyncedCase')
      .mockImplementation((caseId: string) => {
        const foundCase = cases.find((bCase) => bCase.caseId === caseId);
        if (!foundCase) {
          throw new Error('Case not found');
        }
        return Promise.resolve(foundCase);
      });

    const createSpy = vi.spyOn(MockMongoRepository.prototype, 'create').mockResolvedValue({});

    const context: ApplicationContext = await createMockApplicationContext();
    await MigrateOfficeAssigneesUseCase.migrateAssignments(context);

    expect(caseSpy).toHaveBeenCalledTimes(assignments.length);
    expect(createSpy).toHaveBeenCalledTimes(cases.length);
  });

  test('should handle errors when creating office assignees', async () => {
    const court = MOCKED_USTP_OFFICES_ARRAY[0];
    const cases = MockData.buildArray(
      () =>
        MockData.getSyncedCase({
          override: { courtDivisionCode: court.groups[0].divisions[0].divisionCode },
        }),
      2,
    );

    const assignments = cases.map((bCase) => {
      return MockData.getAttorneyAssignment({ caseId: bCase.caseId });
    });

    vi.spyOn(MockMongoRepository.prototype, 'getAllActiveAssignments').mockResolvedValue(
      assignments,
    );

    vi.spyOn(MockOfficesGateway.prototype, 'getOffices').mockResolvedValue(
      MOCKED_USTP_OFFICES_ARRAY,
    );

    vi.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockImplementation((caseId: string) =>
      Promise.resolve(cases.find((bCase) => bCase.caseId === caseId)),
    );

    const createSpy = vi.spyOn(MockMongoRepository.prototype, 'create').mockImplementation(() => {
      throw new Error('Failed to create office assignee');
    });

    const context: ApplicationContext = await createMockApplicationContext();
    await MigrateOfficeAssigneesUseCase.migrateAssignments(context);

    expect(createSpy).toHaveBeenCalledTimes(cases.length);
  });
});
