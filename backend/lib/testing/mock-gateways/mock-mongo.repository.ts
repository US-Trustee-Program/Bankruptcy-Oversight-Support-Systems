/* eslint-disable @typescript-eslint/no-explicit-any */
import { SyncedCase } from '../../../../common/src/cams/cases';
import {
  TransferFrom,
  TransferTo,
  ConsolidationTo,
  ConsolidationFrom,
} from '../../../../common/src/cams/events';
import { CaseHistory } from '../../../../common/src/cams/history';
import { CamsUserReference } from '../../../../common/src/cams/users';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  CamsPaginationResponse,
  CaseAssignmentRepository,
  CasesRepository,
  ConsolidationOrdersRepository,
  ListsRepository,
  OfficeAssigneesRepository,
  OfficesRepository,
  OrdersRepository,
  RuntimeState,
  RuntimeStateRepository,
  StaffRepository,
  TrusteeAppointmentsRepository,
  TrusteesRepository,
  UpdateResult,
  UserGroupsRepository,
  UserSessionCacheRepository,
  UsersRepository,
} from '../../use-cases/gateways.types';
import { TrusteeHistory } from '../../../../common/src/cams/trustees';
import {
  BankList,
  BankListItem,
  BankruptcySoftwareList,
  BankruptcySoftwareListItem,
} from '../../../../common/src/cams/lists';
import { Creatable } from '../../../../common/src/cams/creatable';

export class MockMongoRepository
  implements
    CaseAssignmentRepository,
    CasesRepository,
    ConsolidationOrdersRepository,
    OrdersRepository,
    OfficesRepository,
    RuntimeStateRepository,
    UsersRepository,
    UserSessionCacheRepository,
    OfficeAssigneesRepository,
    TrusteesRepository,
    TrusteeAppointmentsRepository,
    ListsRepository,
    StaffRepository,
    UserGroupsRepository
{
  deleteSyncedCases(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  release() {
    return;
  }

  static getInstance(_context: ApplicationContext) {
    return new MockMongoRepository();
  }

  getAssignmentsForCases(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  findAssignmentsByAssignee(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  findAndDeleteStaff(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getOfficeAttorneys(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  putOrExtendOfficeStaff(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  putOfficeStaff(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  getState<T extends RuntimeState>(..._ignore): Promise<T> {
    throw new Error('Method not implemented.');
  }

  updateState(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  createState<T extends RuntimeState>(..._ignore): Promise<T> {
    throw new Error('Method not implemented.');
  }

  createTransferFrom(..._ignore): Promise<TransferFrom> {
    throw new Error('Method not implemented.');
  }

  createTransferTo(..._ignore): Promise<TransferTo> {
    throw new Error('Method not implemented.');
  }

  createConsolidationTo(..._ignore): Promise<ConsolidationTo> {
    throw new Error('Method not implemented.');
  }

  createConsolidationFrom(..._ignore): Promise<ConsolidationFrom> {
    throw new Error('Method not implemented.');
  }

  getConsolidation(..._ignore): Promise<Array<ConsolidationTo | ConsolidationFrom>> {
    throw new Error('Method not implemented.');
  }

  getCaseHistory(..._ignore): Promise<CaseHistory[]> {
    throw new Error('Method not implemented.');
  }

  createCaseHistory(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  syncDxtrCase(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  update(..._ignore): Promise<any | void> {
    throw new Error('Method not implemented.');
  }

  updateOne(..._ignore): Promise<UpdateResult> {
    throw new Error('Method not implemented.');
  }

  upsert(..._ignore): Promise<any | void> {
    throw new Error('Method not implemented.');
  }

  search(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  searchCases(..._ignore): Promise<CamsPaginationResponse<SyncedCase>> {
    throw new Error('Method not implemented.');
  }

  create(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  createMany(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  read(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  delete(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getNotesByCaseId(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  archiveCaseNote(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  async getTransfers(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  putPrivilegedIdentityUser(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  getPrivilegedIdentityUser(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  deletePrivilegedIdentityUser(..._ignore): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getConsolidationChildCaseIds(..._ignore): Promise<string[]> {
    throw new Error('Method not implemented.');
  }

  getAllActiveAssignments(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  getSyncedCase(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  deleteMany(_ignore: any): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getDistinctAssigneesByOffice(_ignore: any): Promise<CamsUserReference[]> {
    throw new Error('Method not implemented.');
  }

  count(_ignore: any): Promise<number> {
    throw new Error('Method not implemented.');
  }

  createTrustee(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  updateTrustee(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  listTrustees(): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  createTrusteeHistory(_ignore: TrusteeHistory): Promise<void> {
    throw new Error('Method not implemented.');
  }

  listTrusteeHistory(_ignore: string): Promise<TrusteeHistory[]> {
    throw new Error('Method not implemented.');
  }

  getBankruptcySoftwareList(): Promise<BankruptcySoftwareList> {
    throw new Error('Method not implemented.');
  }

  postBankruptcySoftware(_ignore: Creatable<BankruptcySoftwareListItem>): Promise<string> {
    throw new Error('Method not implemented.');
  }

  getBankList(): Promise<BankList> {
    throw new Error('Method not implemented.');
  }

  postBank(_ignore: Creatable<BankListItem>): Promise<string> {
    throw new Error('Method not implemented.');
  }

  deleteBankruptcySoftware(_ignore: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  deleteBank(_ignore: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getTrusteeOversightAssignments(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  createTrusteeOversightAssignment(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  getOversightStaff(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  updateTrusteeOversightAssignment(_ignore: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  upsertUserGroupsBatch(_ignore: any): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getTrusteeAppointments(_ignore: any): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  createAppointment(..._ignore: any[]): Promise<any> {
    throw new Error('Method not implemented.');
  }
}
