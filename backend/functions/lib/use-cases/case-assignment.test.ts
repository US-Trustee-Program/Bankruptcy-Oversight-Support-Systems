import { ApplicationContext } from '../adapters/types/basic';
import { CaseAssignmentUseCase } from './case-assignment';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../testing/testing-utilities';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsRole } from '../../../../common/src/cams/roles';
import CaseManagement from './case-management';
import { getCourtDivisionCodes } from '../../../../common/src/cams/users';

const randomId = () => {
  return '' + Math.random() * 99999999;
};

const createAssignment = jest.fn().mockImplementation(randomId);
const updateAssignment = jest.fn().mockImplementation(randomId);
const createAssignmentHistory = jest.fn().mockImplementation(randomId);
const findAssignmentsByCaseId = jest.fn();

jest.mock('../adapters/gateways/case.assignment.cosmosdb.repository', () => {
  return {
    CaseAssignmentCosmosDbRepository: jest.fn().mockImplementation(() => {
      return {
        createAssignment,
        findAssignmentsByCaseId,
        updateAssignment,
        createAssignmentHistory,
      };
    }),
  };
});

describe('Case assignment tests', () => {
  let applicationContext: ApplicationContext;
  const userOffice = MockData.randomUstpOffice();
  const user = {
    id: 'userId-Mock Name',
    name: 'Mock Name',
    offices: [userOffice],
    roles: [CamsRole.CaseAssignmentManager],
  };

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext({
      env: {
        STARTING_MONTH: '-6',
      },
    });
    applicationContext.session = await createMockApplicationContextSession({ user });
  });

  describe('findAssignmentsByCaseId', () => {
    test('should return all assignments for a given case ID', async () => {
      const caseId = '111-22-12345';
      const assignments = [
        {
          caseId: caseId,
          name: 'Joe',
          role: CamsRole.TrialAttorney,
          assignedOn: new Date().toISOString(),
        },
        {
          caseId: caseId,
          name: 'Jane',
          role: CamsRole.TrialAttorney,
          assignedOn: new Date().toISOString(),
        },
      ];
      findAssignmentsByCaseId.mockResolvedValue(assignments);

      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);

      const actualAssignments = await assignmentUseCase.findAssignmentsByCaseId(caseId);

      expect(actualAssignments.length).toEqual(2);
      expect(actualAssignments).toEqual(expect.arrayContaining(assignments));
    });
  });

  describe('createTrialAttorneyAssignments', () => {
    const attorneyJaneSmith = { id: 'userId-Jane Smith', name: 'Jane Smith' };
    const attorneyJoeNobel = { id: 'userId-Joe Nobel', name: 'Joe Nobel' };
    const caseId = '081-23-01176';
    const role = CamsRole.TrialAttorney;

    test('should create new case assignments when none exist on the case', async () => {
      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);
      jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue(
        MockData.getCaseDetail({
          override: { courtDivisionCode: getCourtDivisionCodes(user)[0] },
        }),
      );

      findAssignmentsByCaseId.mockResolvedValue([]);

      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      await assignmentUseCase.createTrialAttorneyAssignments(
        applicationContext,
        caseId,
        assignments,
        role.toString(),
      );

      const assignmentOne = {
        caseId,
        userId: attorneyJaneSmith.id,
        name: attorneyJaneSmith.name,
        role,
      };

      const assignmentTwo = {
        caseId,
        userId: attorneyJoeNobel.id,
        name: attorneyJoeNobel.name,
        role,
      };

      expect(createAssignment.mock.calls[0][0]).toEqual(expect.objectContaining(assignmentOne));
      expect(createAssignment.mock.calls[1][0]).toEqual(expect.objectContaining(assignmentTwo));
    });

    test('should add new case assignments on a case with existing assignments', async () => {
      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);
      jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue(
        MockData.getCaseDetail({
          override: { courtDivisionCode: getCourtDivisionCodes(user)[0] },
        }),
      );

      const assignments = [attorneyJaneSmith, attorneyJoeNobel];

      const assignmentOne = {
        caseId,
        userId: attorneyJaneSmith.id,
        name: attorneyJaneSmith.name,
        role,
      };

      const assignmentTwo = {
        caseId,
        userId: attorneyJoeNobel.id,
        name: attorneyJoeNobel.name,
        role,
      };

      findAssignmentsByCaseId.mockResolvedValue([assignmentOne]);

      await assignmentUseCase.createTrialAttorneyAssignments(
        applicationContext,
        caseId,
        assignments,
        role.toString(),
      );

      expect(createAssignment.mock.calls[0][0]).toEqual(expect.objectContaining(assignmentTwo));
      expect(createAssignment).toHaveBeenCalledTimes(1);
    });

    test('should remove assignments', async () => {
      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);

      jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue(
        MockData.getCaseDetail({
          override: { courtDivisionCode: getCourtDivisionCodes(user)[0] },
        }),
      );

      const assignments = [];

      const assignmentOne = {
        caseId,
        userId: attorneyJaneSmith.id,
        name: attorneyJaneSmith.name,
        role,
      };

      findAssignmentsByCaseId.mockResolvedValue([assignmentOne]);

      await assignmentUseCase.createTrialAttorneyAssignments(
        applicationContext,
        caseId,
        assignments,
        role.toString(),
      );

      expect(updateAssignment.mock.calls[0][0]).toEqual(expect.objectContaining(assignmentOne));
      expect(updateAssignment).toHaveBeenCalledTimes(1);
    });

    test('should not do anything if user does not have the CaseAssignmentManager role', async () => {
      applicationContext.session = await createMockApplicationContextSession();
      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);

      findAssignmentsByCaseId.mockResolvedValue([]);

      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      await expect(
        assignmentUseCase.createTrialAttorneyAssignments(
          applicationContext,
          caseId,
          assignments,
          role.toString(),
        ),
      ).rejects.toThrow('User does not have appropriate access to create assignments.');

      expect(createAssignment).not.toHaveBeenCalled();
    });

    test('should not do anything if user does have the CaseAssignmentManager role but not for the correct division', async () => {
      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);
      jest
        .spyOn(CaseManagement.prototype, 'getCaseSummary')
        .mockResolvedValue(MockData.getCaseDetail({ override: { courtDivisionCode: '0000' } }));

      findAssignmentsByCaseId.mockResolvedValue([]);

      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      await expect(
        assignmentUseCase.createTrialAttorneyAssignments(
          applicationContext,
          caseId,
          assignments,
          role.toString(),
        ),
      ).rejects.toThrow(
        'User does not have appropriate access to create assignments for this office.',
      );

      expect(createAssignment).not.toHaveBeenCalled();
    });
  });
});
