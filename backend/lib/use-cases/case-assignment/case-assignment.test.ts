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
import { OfficeStaff } from '../../adapters/gateways/mongo/offices.mongo.repository';
import { ACMS_SYSTEM_USER_REFERENCE } from '../../../../common/src/cams/auditable';
import { MANHATTAN } from '../../../../common/src/cams/test-utilities/courts.mock';
import { OfficeUserRolesPredicate } from '../../../../common/src/api/search';

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
      jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue(expectedMap);

      const assignmentUseCase = new CaseAssignmentUseCase(applicationContext);

      const actualAssignments = await assignmentUseCase.findAssignmentsByCaseId([caseId]);

      expect(actualAssignments.get(caseId).length).toEqual(2);
      expect(actualAssignments).toEqual(expectedMap);
    });
  });

  describe('createTrialAttorneyAssignments', () => {
    const attorneyJaneSmith = { id: 'userId-Jane Smith', name: 'Jane Smith' };
    const officeStaffJaneSmith: OfficeStaff = {
      ...attorneyJaneSmith,
      updatedBy: ACMS_SYSTEM_USER_REFERENCE,
      updatedOn: MockData.getDateBeforeToday().toISOString(),
      officeCode: MANHATTAN.officeCode,
      roles: [CamsRole.TrialAttorney],
      documentType: 'OFFICE_STAFF',
      ttl: 100,
    };
    const attorneyJoeNobel = { id: 'userId-Joe Nobel', name: 'Joe Nobel' };
    const officeStaffJoeNobel = {
      ...officeStaffJaneSmith,
      ...attorneyJoeNobel,
    };
    const caseId = '081-23-01176';
    const role = CamsRole.TrialAttorney;

    beforeEach(async () => {
      applicationContext = await createMockApplicationContext({
        env: {
          STARTING_MONTH: '-6',
        },
      });
      applicationContext.session = await createMockApplicationContextSession({ user });
      jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue(new Map([[caseId, []]]));
      const syncedCase = MockData.getSyncedCase({ override: { caseId } });
      jest.spyOn(MockMongoRepository.prototype, 'getSyncedCase').mockResolvedValue(syncedCase);
      jest
        .spyOn(MockMongoRepository.prototype, 'search')
        .mockImplementation((predicate: OfficeUserRolesPredicate) => {
          if (predicate.userId === attorneyJoeNobel.id) {
            return Promise.resolve([officeStaffJoeNobel]);
          } else if (predicate.userId === attorneyJaneSmith.id) {
            return Promise.resolve([officeStaffJaneSmith]);
          } else {
            return Promise.resolve([]);
          }
        });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('should not create assignments if one or more user ids is not found', async () => {
      jest
        .spyOn(MockMongoRepository.prototype, 'search')
        .mockImplementation((predicate: OfficeUserRolesPredicate) => {
          if (predicate.userId === attorneyJoeNobel.id) {
            return Promise.resolve([officeStaffJoeNobel]);
          } else {
            return Promise.resolve([]);
          }
        });
      const context = { ...applicationContext };
      context.session = MockData.getManhattanAssignmentManagerSession();
      const assignmentUseCase = new CaseAssignmentUseCase(context);
      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      await expect(
        assignmentUseCase.createTrialAttorneyAssignments(
          context,
          caseId,
          assignments,
          role.toString(),
        ),
      ).rejects.toThrow('Invalid assignments found.');
    });

    test('should not create assignments if one or more names do not match', async () => {
      jest
        .spyOn(MockMongoRepository.prototype, 'search')
        .mockImplementation((predicate: OfficeUserRolesPredicate) => {
          if (predicate.userId === attorneyJoeNobel.id) {
            return Promise.resolve([officeStaffJoeNobel]);
          } else if (predicate.userId === attorneyJaneSmith.id) {
            return Promise.resolve([{ ...officeStaffJaneSmith, name: 'Joe Nobel' }]);
          } else {
            return Promise.resolve([]);
          }
        });
      const context = { ...applicationContext };
      context.session = MockData.getManhattanAssignmentManagerSession();
      const assignmentUseCase = new CaseAssignmentUseCase(context);
      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      await expect(
        assignmentUseCase.createTrialAttorneyAssignments(
          context,
          caseId,
          assignments,
          role.toString(),
        ),
      ).rejects.toThrow('Invalid assignments found.');
    });

    test('should not create assignments if one or more roles do not match', async () => {
      jest
        .spyOn(MockMongoRepository.prototype, 'search')
        .mockImplementation((predicate: OfficeUserRolesPredicate) => {
          if (predicate.userId === attorneyJoeNobel.id) {
            return Promise.resolve([officeStaffJoeNobel]);
          } else if (predicate.userId === attorneyJaneSmith.id) {
            return Promise.resolve([{ ...officeStaffJaneSmith, roles: [CamsRole.DataVerifier] }]);
          } else {
            return Promise.resolve([]);
          }
        });
      const context = { ...applicationContext };
      context.session = MockData.getManhattanAssignmentManagerSession();
      const assignmentUseCase = new CaseAssignmentUseCase(context);
      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      await expect(
        assignmentUseCase.createTrialAttorneyAssignments(
          context,
          caseId,
          assignments,
          role.toString(),
        ),
      ).rejects.toThrow('Invalid assignments found.');
    });

    test('should log but not reject Promise.all when one of multiple searches fails', async () => {
      jest
        .spyOn(MockMongoRepository.prototype, 'search')
        .mockImplementation((predicate: OfficeUserRolesPredicate) => {
          if (predicate.userId === attorneyJoeNobel.id) {
            return new Promise((resolve) => setTimeout(() => resolve([officeStaffJoeNobel]), 200));
          } else {
            return Promise.reject();
          }
        });
      const context = { ...applicationContext };
      context.session = MockData.getManhattanAssignmentManagerSession();
      const assignmentUseCase = new CaseAssignmentUseCase(context);
      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      const loggerSpy = jest.spyOn(context.logger, 'camsError');
      await expect(
        assignmentUseCase.createTrialAttorneyAssignments(
          context,
          caseId,
          assignments,
          role.toString(),
        ),
      ).rejects.toThrow('Invalid assignments found.');

      expect(loggerSpy).toHaveBeenCalledTimes(1);
    });

    test('should not create assignments if role is not a CamsRole', async () => {
      jest
        .spyOn(MockMongoRepository.prototype, 'search')
        .mockImplementation((predicate: OfficeUserRolesPredicate) => {
          if (predicate.userId === attorneyJoeNobel.id) {
            return Promise.resolve([officeStaffJoeNobel]);
          } else if (predicate.userId === attorneyJaneSmith.id) {
            return Promise.resolve([officeStaffJaneSmith]);
          } else {
            return Promise.resolve([]);
          }
        });
      const context = { ...applicationContext };
      context.session = MockData.getManhattanAssignmentManagerSession();
      const assignmentUseCase = new CaseAssignmentUseCase(context);
      const assignments = [attorneyJaneSmith, attorneyJoeNobel];
      await expect(
        assignmentUseCase.createTrialAttorneyAssignments(
          context,
          caseId,
          assignments,
          'TrialDragon',
        ),
      ).rejects.toThrow('Invalid assignments found.');
    });

    test('should create new case assignments when none exist on the case', async () => {
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
      jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue(new Map([[caseId, []]]));

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

      jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue(new Map([[caseId, [assignmentOne]]]));

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

      jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue(new Map([[caseId, [assignmentOne]]]));

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
      jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue(new Map());

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
      jest
        .spyOn(MockMongoRepository.prototype, 'getAssignmentsForCases')
        .mockResolvedValue(new Map());
      const createAssignment = jest
        .spyOn(MockMongoRepository.prototype, 'create')
        .mockImplementation((consolidationOrder: ConsolidationOrder) => {
          return Promise.resolve(
            MockData.getConsolidationOrder({ override: { ...consolidationOrder } }),
          );
        });

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
