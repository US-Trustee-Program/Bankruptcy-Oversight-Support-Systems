import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAssignmentUseCase } from './case-assignment';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import { CamsRole } from '../../../../common/src/cams/roles';
import CaseManagement from '../cases/case-management';
import { getCourtDivisionCodes } from '../../../../common/src/cams/users';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { ConsolidationOrder } from '../../../../common/src/cams/orders';
import OfficeAssigneesUseCase from '../../use-cases/offices/office-assignees';

const randomId = () => {
  return '' + Math.random() * 99999999;
};

describe('Case assignment tests', () => {
  let applicationContext: ApplicationContext;
  const userOffice = MockData.randomUstpOffice();
  const user = {
    id: 'userId-Mock Name',
    name: 'Mock Name',
    offices: [userOffice],
    roles: [CamsRole.CaseAssignmentManager],
  };

  describe('findAssignmentsByCaseId', () => {
    beforeEach(async () => {
      applicationContext = await createMockApplicationContext({
        env: {
          STARTING_MONTH: '-6',
        },
      });
      applicationContext.session = await createMockApplicationContextSession({ user });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should return all assignments for a given case ID', async () => {
      const findAssignmentsByCaseId = jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue([]);
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

      const expectedMap = new Map([[caseId, assignments]]);
      findAssignmentsByCaseId.mockResolvedValue(expectedMap);

      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);

      const actualAssignments = await assignmentUseCase.findAssignmentsByCaseId([caseId]);

      expect(actualAssignments.get(caseId).length).toEqual(2);
      expect(actualAssignments).toEqual(expectedMap);
    });
  });

  describe('createTrialAttorneyAssignments', () => {
    const attorneyJaneSmith = { id: 'userId-Jane Smith', name: 'Jane Smith' };
    const attorneyJoeNobel = { id: 'userId-Joe Nobel', name: 'Joe Nobel' };
    const caseId = '081-23-01176';
    const role = CamsRole.TrialAttorney;

    beforeEach(async () => {
      applicationContext = await createMockApplicationContext({
        env: {
          STARTING_MONTH: '-6',
        },
      });
      applicationContext.session = await createMockApplicationContextSession({ user });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should not create assignment for not found user id', async () => {
      jest
        .spyOn(MockMongoRepository.prototype, 'search')
        .mockRejectedValue(new Error('this should be called but will not be yet'));
      jest.spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases').mockResolvedValue([]);
      const context = { ...applicationContext };
      context.session = await createMockApplicationContextSession({ user });
      const assignmentUseCase = new CaseAssignmentUseCase(context);
      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      // TODO: I don't completely understand the intent of this test based on
      // the description.  The user so far, is found, but the office and division
      // codes assigned to this user does not match 081 which is the office we're looking for
      // so this user is not a member of that office. case-assignment.ts line 44
      await expect(
        assignmentUseCase.createTrialAttorneyAssignments(
          context,
          caseId,
          assignments,
          role.toString(),
        ),
      ).rejects.toThrow('this should be called but will not be yet');
    });

    test('should create new case assignments when none exist on the case', async () => {
      const findAssignmentsByCaseId = jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue([]);
      jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue(
        MockData.getCaseDetail({
          override: { courtDivisionCode: getCourtDivisionCodes(user)[0] },
        }),
      );
      const createAssignment = jest
        .spyOn(MockMongoRepository.prototype, 'create')
        .mockImplementation((consolidationOrder: ConsolidationOrder) => {
          return Promise.resolve(
            MockData.getConsolidationOrder({ override: { ...consolidationOrder } }),
          );
        });
      jest.spyOn(MockMongoRepository.prototype, 'createCaseHistory').mockResolvedValue();
      jest.spyOn(MockMongoRepository.prototype, 'getConsolidation').mockResolvedValue([]);
      jest.spyOn(MockMongoRepository.prototype, 'update').mockResolvedValue(randomId);
      findAssignmentsByCaseId.mockResolvedValue(new Map([[caseId, []]]));

      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);
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
      const findAssignmentsByCaseId = jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue([]);
      const createAssignment = jest
        .spyOn(MockMongoRepository.prototype, 'create')
        .mockImplementation((consolidationOrder: ConsolidationOrder) => {
          return Promise.resolve(
            MockData.getConsolidationOrder({ override: { ...consolidationOrder } }),
          );
        });
      jest.spyOn(MockMongoRepository.prototype, 'createCaseHistory').mockResolvedValue();
      jest.spyOn(MockMongoRepository.prototype, 'getConsolidation').mockResolvedValue([]);
      jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue(
        MockData.getCaseDetail({
          override: { courtDivisionCode: getCourtDivisionCodes(user)[0] },
        }),
      );
      const assignmentEventSpy = jest
        .spyOn(OfficeAssigneesUseCase, 'handleCaseAssignmentEvent')
        .mockResolvedValue();

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

      findAssignmentsByCaseId.mockResolvedValue(new Map([[caseId, [assignmentOne]]]));

      await assignmentUseCase.createTrialAttorneyAssignments(
        applicationContext,
        caseId,
        assignments,
        role.toString(),
      );

      expect(createAssignment.mock.calls[0][0]).toEqual(expect.objectContaining(assignmentTwo));
      expect(createAssignment).toHaveBeenCalledTimes(1);

      expect(assignmentEventSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ...assignmentTwo }),
      );
    });

    test('should remove assignments', async () => {
      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);

      jest.spyOn(MockMongoRepository.prototype, 'createCaseHistory').mockResolvedValue();
      const updateAssignment = jest
        .spyOn(MockMongoRepository.prototype, 'update')
        .mockResolvedValue(randomId);
      const findAssignmentsByCaseId = jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue([]);
      jest.spyOn(CaseManagement.prototype, 'getCaseSummary').mockResolvedValue(
        MockData.getCaseDetail({
          override: { courtDivisionCode: getCourtDivisionCodes(user)[0] },
        }),
      );
      jest.spyOn(MockMongoRepository.prototype, 'getConsolidation').mockResolvedValue([]);
      const assignmentEventSpy = jest
        .spyOn(OfficeAssigneesUseCase, 'handleCaseAssignmentEvent')
        .mockResolvedValue();

      const assignments = [];

      const assignmentOne = {
        caseId,
        userId: attorneyJaneSmith.id,
        name: attorneyJaneSmith.name,
        role,
      };

      findAssignmentsByCaseId.mockResolvedValue(new Map([[caseId, [assignmentOne]]]));

      await assignmentUseCase.createTrialAttorneyAssignments(
        applicationContext,
        caseId,
        assignments,
        role.toString(),
      );

      expect(updateAssignment.mock.calls[0][0]).toEqual(expect.objectContaining(assignmentOne));
      expect(updateAssignment).toHaveBeenCalledTimes(1);
      expect(assignmentEventSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ...assignmentOne }),
      );
    });

    test('should not do anything if user does not have the CaseAssignmentManager role', async () => {
      const findAssignmentsByCaseId = jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue([]);
      const createAssignment = jest
        .spyOn(MockMongoRepository.prototype, 'create')
        .mockImplementation((consolidationOrder: ConsolidationOrder) => {
          return Promise.resolve(
            MockData.getConsolidationOrder({ override: { ...consolidationOrder } }),
          );
        });
      const context = { ...applicationContext };
      context.session = await createMockApplicationContextSession();
      const assignmentUseCase = new CaseAssignmentUseCase(context);

      findAssignmentsByCaseId.mockResolvedValue([]);

      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      await expect(
        assignmentUseCase.createTrialAttorneyAssignments(
          context,
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
      const findAssignmentsByCaseId = jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue([]);
      const createAssignment = jest
        .spyOn(MockMongoRepository.prototype, 'create')
        .mockImplementation((consolidationOrder: ConsolidationOrder) => {
          return Promise.resolve(
            MockData.getConsolidationOrder({ override: { ...consolidationOrder } }),
          );
        });

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
