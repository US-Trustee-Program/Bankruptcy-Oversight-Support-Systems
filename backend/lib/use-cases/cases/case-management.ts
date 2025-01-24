import { ApplicationContext } from '../../adapters/types/basic';
import Factory, {
  getAssignmentRepository,
  getCasesGateway,
  getOfficesGateway,
} from '../../factory';
import { CasesInterface } from './cases.interface';
import { CaseAssignmentUseCase } from '../case-assignment/case-assignment';
import { UnknownError } from '../../common-errors/unknown-error';
import { isCamsError } from '../../common-errors/cams-error';
import { AssignmentError } from '../case-assignment/assignment.exception';
import { OfficesGateway } from '../offices/offices.types';
import { CaseAssignmentRepository } from '../gateways.types';
import { buildOfficeCode } from '../offices/offices';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import {
  CaseBasics,
  CaseDetail,
  CaseSummary,
  DxtrCase,
  SyncedCase,
} from '../../../../common/src/cams/cases';
import Actions, { Action, ResourceActions } from '../../../../common/src/cams/actions';
import { getCourtDivisionCodes } from '../../../../common/src/cams/users';
import { CamsRole } from '../../../../common/src/cams/roles';
import { CasesSearchPredicate } from '../../../../common/src/api/search';
import { CaseAssignment } from '../../../../common/src/cams/assignments';
import { createAuditRecord } from '../../../../common/src/cams/auditable';

const MODULE_NAME = 'CASE-MANAGEMENT-USE-CASE';

export function getAction<T extends CaseBasics>(
  context: ApplicationContext,
  bCase: ResourceActions<T>,
): Action[] {
  const userDivisions = getCourtDivisionCodes(context.session.user);
  const actions: Action[] = [];
  if (
    userDivisions.includes(bCase.courtDivisionCode) &&
    context.session.user.roles.includes(CamsRole.CaseAssignmentManager)
  ) {
    actions.push(Actions.merge(Actions.ManageAssignments, bCase));
  }
  return actions;
}

export default class CaseManagement {
  assignmentGateway: CaseAssignmentRepository;
  casesGateway: CasesInterface;
  officesGateway: OfficesGateway;

  constructor(applicationContext: ApplicationContext, casesGateway?: CasesInterface) {
    this.assignmentGateway = getAssignmentRepository(applicationContext);
    this.casesGateway = casesGateway ? casesGateway : getCasesGateway(applicationContext);
    this.officesGateway = getOfficesGateway(applicationContext);
  }

  public async searchCases(
    context: ApplicationContext,
    predicate: CasesSearchPredicate,
    includeAssignments: boolean,
  ): Promise<ResourceActions<CaseBasics>[]> {
    try {
      if (predicate.assignments && predicate.assignments.length > 0) {
        const caseIdSet = new Set<string>();
        for (const user of predicate.assignments) {
          const caseAssignments = await this.assignmentGateway.findAssignmentsByAssignee(user.id);
          caseAssignments.forEach((caseAssignment) => {
            caseIdSet.add(caseAssignment.caseId);
          });
        }
        predicate.caseIds = Array.from(caseIdSet);
        // if we're requesting cases with specific assignments, and none are found, return [] early

        if (predicate.caseIds.length == 0) {
          return [];
        }
      }

      const cases: ResourceActions<CaseBasics>[] = await this.casesGateway.searchCases(
        context,
        predicate,
      );

      const caseIds = [];
      for (const casesKey in cases) {
        caseIds.push(cases[casesKey].caseId);
        const bCase = cases[casesKey];
        bCase.officeCode = buildOfficeCode(bCase.regionId, bCase.courtDivisionCode);
        bCase._actions = getAction<CaseBasics>(context, bCase);
      }

      if (includeAssignments) {
        const assignmentsMap = await this.assignmentGateway.findAssignmentsByCaseId(caseIds);
        for (const casesKey in cases) {
          const assignments = assignmentsMap.get(cases[casesKey].caseId) ?? [];
          cases[casesKey] = {
            ...cases[casesKey],
            assignments,
          };
        }
      }

      return cases;
    } catch (originalError) {
      if (!isCamsError(originalError)) {
        throw new UnknownError(MODULE_NAME, {
          message:
            'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
          originalError,
          status: 500,
        });
      } else {
        throw originalError;
      }
    }
  }

  public async getCaseDetail(
    context: ApplicationContext,
    caseId: string,
  ): Promise<ResourceActions<CaseDetail>> {
    const casesRepo = Factory.getCasesRepository(context);
    try {
      const caseDetails = await this.casesGateway.getCaseDetail(context, caseId);
      caseDetails.transfers = await casesRepo.getTransfers(caseId);
      caseDetails.consolidation = await casesRepo.getConsolidation(caseId);
      caseDetails.assignments = await this.getCaseAssignments(context, caseDetails);
      caseDetails.officeName = this.officesGateway.getOfficeName(caseDetails.courtDivisionCode);
      caseDetails.officeCode = buildOfficeCode(caseDetails.regionId, caseDetails.courtDivisionCode);
      const _actions = getAction<CaseDetail>(context, caseDetails);

      return { ...caseDetails, _actions };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async getCaseSummary(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<CaseSummary> {
    try {
      const caseSummary = await this.casesGateway.getCaseSummary(applicationContext, caseId);
      return caseSummary;
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async getDxtrCase(
    applicationContext: ApplicationContext,
    caseId: string,
  ): Promise<DxtrCase> {
    try {
      const caseDetails = await this.casesGateway.getCaseDetail(applicationContext, caseId);
      delete caseDetails.debtorAttorney;
      return { ...caseDetails };
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    }
  }

  public async syncCase(context: ApplicationContext, bCase: DxtrCase) {
    try {
      const casesRepo = Factory.getCasesRepository(context);
      const synced = createAuditRecord<SyncedCase>({ ...bCase, documentType: 'SYNCED_CASE' });
      await casesRepo.syncDxtrCase(synced);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          message: `Failed to sync DXTR case ${bCase.caseId}.`,
          module: MODULE_NAME,
        },
      });
    }
  }

  private async getCaseAssignments(
    context: ApplicationContext,
    bCase: CaseDetail,
  ): Promise<CaseAssignment[]> {
    const caseAssignment = new CaseAssignmentUseCase(context);
    try {
      const assignmentsMap = await caseAssignment.findAssignmentsByCaseId([bCase.caseId]);
      return assignmentsMap.get(bCase.caseId);
    } catch (e) {
      throw new AssignmentError(MODULE_NAME, {
        message:
          'Unable to retrieve case list. Please try again later. If the problem persists, please contact USTP support.',
        originalError: e,
        status: 500,
      });
    }
  }
}
