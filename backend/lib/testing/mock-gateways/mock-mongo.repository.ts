/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  TransferFrom,
  TransferTo,
  ConsolidationTo,
  ConsolidationFrom,
} from '../../../../common/src/cams/events';
import { CaseHistory } from '../../../../common/src/cams/history';
import { ApplicationContext } from '../../adapters/types/basic';
import {
  CaseAssignmentRepository,
  CasesRepository,
  ConsolidationOrdersRepository,
  OfficesRepository,
  OrdersRepository,
  RuntimeState,
  RuntimeStateRepository,
  UserSessionCacheRepository,
} from '../../use-cases/gateways.types';

export class MockMongoRepository
  implements
    CaseAssignmentRepository,
    CasesRepository,
    ConsolidationOrdersRepository,
    OrdersRepository,
    OfficesRepository,
    RuntimeStateRepository,
    UserSessionCacheRepository
{
  private static singleton: MockMongoRepository;

  release() {
    return;
  }

  static getInstance(_context: ApplicationContext) {
    return new MockMongoRepository();
  }

  findAssignmentsByCaseId(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  findAssignmentsByAssignee(..._ignore): Promise<any> {
    throw new Error('Method not implemented.');
  }

  getOfficeAttorneys(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }

  putOfficeStaff(..._ignore): Promise<void> {
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

  deleteMigrations(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  update(..._ignore): Promise<any | void> {
    throw new Error('Method not implemented.');
  }

  upsert(..._ignore): Promise<any | void> {
    throw new Error('Method not implemented.');
  }

  search(..._ignore): Promise<any[]> {
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

  async getTransfers(..._ignore): Promise<any[]> {
    throw new Error('Method not implemented.');
  }
}
