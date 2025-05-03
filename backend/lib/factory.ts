import { config, ConnectionPool } from 'mssql';

import { AcmsGatewayImpl } from './adapters/gateways/acms/acms.gateway';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import { DxtrCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.dxtr.gateway';
import { MockCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.mock.gateway';
import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import OfficesDxtrGateway from './adapters/gateways/dxtr/offices.dxtr.gateway';
import { DxtrOrdersGateway } from './adapters/gateways/dxtr/orders.dxtr.gateway';
import { CaseAssignmentMongoRepository } from './adapters/gateways/mongo/case-assignment.mongo.repository';
import { CaseNotesMongoRepository } from './adapters/gateways/mongo/case-notes.mongo.repository';
import { CasesMongoRepository } from './adapters/gateways/mongo/cases.mongo.repository';
import ConsolidationOrdersMongoRepository from './adapters/gateways/mongo/consolidations.mongo.repository';
import { OfficeAssigneeMongoRepository } from './adapters/gateways/mongo/office-assignee.mongo.repository';
import { OfficesMongoRepository } from './adapters/gateways/mongo/offices.mongo.repository';
import { OrdersMongoRepository } from './adapters/gateways/mongo/orders.mongo.repository';
import { RuntimeStateMongoRepository } from './adapters/gateways/mongo/runtime-state.mongo.repository';
import { UserSessionCacheMongoRepository } from './adapters/gateways/mongo/user-session-cache.mongo.repository';
import { UsersMongoRepository } from './adapters/gateways/mongo/user.repository';
import OktaGateway from './adapters/gateways/okta/okta-gateway';
import OktaUserGroupGateway from './adapters/gateways/okta/okta-user-group-gateway';
import StorageQueueGateway from './adapters/gateways/storage-queue/storage-queue-gateway';
import LocalStorageGateway from './adapters/gateways/storage/local-storage-gateway';
import { OpenIdConnectGateway, UserGroupGateway } from './adapters/types/authorization';
import { ApplicationContext } from './adapters/types/basic';
import { IDbConfig } from './adapters/types/database';
import { StorageGateway } from './adapters/types/storage';
import { getCamsErrorWithStack } from './common-errors/error-utilities';
import { deferRelease } from './deferrable/defer-release';
import MockAttorneysGateway from './testing/mock-gateways/mock-attorneys.gateway';
import { MockMongoRepository } from './testing/mock-gateways/mock-mongo.repository';
import MockOpenIdConnectGateway from './testing/mock-gateways/mock-oauth2-gateway';
import MockUserGroupGateway from './testing/mock-gateways/mock-user-group-gateway';
import { MockUserSessionUseCase } from './testing/mock-gateways/mock-user-session-use-case';
import { MockOfficesGateway } from './testing/mock-gateways/mock.offices.gateway';
import { MockOfficesRepository } from './testing/mock-gateways/mock.offices.repository';
import { MockOrdersGateway } from './testing/mock-gateways/mock.orders.gateway';
import { AttorneyGatewayInterface } from './use-cases/attorneys/attorney.gateway.interface';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';
import { CasesInterface } from './use-cases/cases/cases.interface';
import {
  AcmsGateway,
  CaseAssignmentRepository,
  CaseNotesRepository,
  CasesRepository,
  CasesSyncState,
  ConsolidationOrdersRepository,
  OfficeAssigneesRepository,
  OfficesRepository,
  OfficeStaffSyncState,
  OrdersGateway,
  OrdersRepository,
  OrderSyncState,
  QueueGateway,
  RuntimeState,
  RuntimeStateRepository,
  UserSessionCacheRepository,
  UsersRepository,
} from './use-cases/gateways.types';
import { OfficesGateway } from './use-cases/offices/offices.types';
import { UserSessionUseCase } from './use-cases/user-session/user-session';

let casesGateway: CasesInterface;
let ordersGateway: OrdersGateway;
let storageGateway: StorageGateway;
let acmsGateway: AcmsGateway;
let idpApiGateway: UserGroupGateway;

let orderSyncStateRepo: RuntimeStateRepository<OrderSyncState>;
let casesSyncStateRepo: RuntimeStateRepository<CasesSyncState>;
let officeStaffSyncStateRepo: RuntimeStateRepository<OfficeStaffSyncState>;
let usersRepository: UsersRepository;

let mockOrdersRepository: MockMongoRepository;
let mockConsolidationsRepository: MockMongoRepository;
let mockCasesRepository: MockMongoRepository;
let mockUserSessionCacheRepository: MockMongoRepository;

export const getAttorneyGateway = (): AttorneyGatewayInterface => {
  return MockAttorneysGateway;
};

export const getCasesGateway = (context: ApplicationContext): CasesInterface => {
  if (!casesGateway) {
    if (context.config.get('dbMock')) {
      casesGateway = new CasesLocalGateway();
    } else {
      casesGateway = new CasesDxtrGateway();
    }
  }
  return casesGateway;
};

export const getAssignmentRepository = (context: ApplicationContext): CaseAssignmentRepository => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  const repo = CaseAssignmentMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

export const getCaseNotesRepository = (context: ApplicationContext): CaseNotesRepository => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  const repo = CaseNotesMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

export const getCaseDocketUseCase = (context: ApplicationContext): CaseDocketUseCase => {
  const gateway = context.config.get('dbMock')
    ? new MockCaseDocketGateway()
    : new DxtrCaseDocketGateway();
  return new CaseDocketUseCase(gateway);
};

export const getSqlConnection = (databaseConfig: IDbConfig) => {
  // Reference https://github.com/tediousjs/node-mssql#readme
  // TODO We may want to refactor this to use non ConnectionPool connection object since we have moved to function app.
  return new ConnectionPool(databaseConfig as config);
};

export const getOrdersGateway = (context: ApplicationContext): OrdersGateway => {
  if (!ordersGateway) {
    if (context.config.get('dbMock')) {
      ordersGateway = new MockOrdersGateway();
    } else {
      ordersGateway = new DxtrOrdersGateway();
    }
  }
  return ordersGateway;
};

export const getOfficesGateway = (context: ApplicationContext): OfficesGateway => {
  if (context.config.get('dbMock')) {
    return new MockOfficesGateway();
  } else {
    return new OfficesDxtrGateway();
  }
};

export const getOfficesRepository = (context: ApplicationContext): OfficesRepository => {
  if (context.config.authConfig.provider === 'mock') {
    return MockOfficesRepository;
  }
  const repo = OfficesMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

// transfer orders
export const getOrdersRepository = (context: ApplicationContext): OrdersRepository => {
  if (context.config.get('dbMock')) {
    if (!mockOrdersRepository) {
      mockOrdersRepository = MockMongoRepository.getInstance(context);
    }
    return mockOrdersRepository;
  } else {
    const repo = OrdersMongoRepository.getInstance(context);
    deferRelease(repo, context);
    return repo;
  }
};

export const getConsolidationOrdersRepository = (
  context: ApplicationContext,
): ConsolidationOrdersRepository => {
  if (context.config.get('dbMock')) {
    if (!mockConsolidationsRepository) {
      mockConsolidationsRepository = MockMongoRepository.getInstance(context);
    }
    return mockConsolidationsRepository;
  } else {
    const repo = ConsolidationOrdersMongoRepository.getInstance(context);
    deferRelease(repo, context);
    return repo;
  }
};

export const getCasesRepository = (context: ApplicationContext): CasesRepository => {
  if (context.config.get('dbMock')) {
    if (!mockCasesRepository) {
      mockCasesRepository = MockMongoRepository.getInstance(context);
    }
    return mockCasesRepository;
  }
  const repo = CasesMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

export const getRuntimeStateRepository = <T extends RuntimeState>(
  context: ApplicationContext,
): RuntimeStateRepository<T> => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  return new RuntimeStateMongoRepository<T>(context);
};

export const getOrderSyncStateRepo = (
  context: ApplicationContext,
): RuntimeStateRepository<OrderSyncState> => {
  if (!orderSyncStateRepo) {
    orderSyncStateRepo = getRuntimeStateRepository<OrderSyncState>(context);
  }
  return orderSyncStateRepo;
};

export const getOfficeStaffSyncStateRepo = (
  context: ApplicationContext,
): RuntimeStateRepository<OfficeStaffSyncState> => {
  if (!officeStaffSyncStateRepo) {
    officeStaffSyncStateRepo = getRuntimeStateRepository<OfficeStaffSyncState>(context);
  }
  return officeStaffSyncStateRepo;
};

export const getCasesSyncStateRepo = (
  context: ApplicationContext,
): RuntimeStateRepository<CasesSyncState> => {
  if (!casesSyncStateRepo) {
    context.logger.info('FACTORY', 'Creating new cases sync state repo.');
    casesSyncStateRepo = getRuntimeStateRepository<CasesSyncState>(context);
  }
  context.logger.info('FACTORY', 'Returning cases sync state repo.');
  return casesSyncStateRepo;
};

export const getUsersRepository = (context: ApplicationContext): UsersRepository => {
  if (context.config.get('dbMock')) {
    return MockMongoRepository.getInstance(context);
  }

  if (!usersRepository) {
    usersRepository = new UsersMongoRepository(context);
    deferRelease(usersRepository, context);
  }
  return usersRepository;
};

export const getAuthorizationGateway = (context: ApplicationContext): OpenIdConnectGateway => {
  if (context.config.authConfig.provider === 'okta') {
    return OktaGateway;
  }
  if (context.config.authConfig.provider === 'mock') {
    return MockOpenIdConnectGateway;
  }
  return null;
};

export const getUserSessionUseCase = (context: ApplicationContext) => {
  if (context.config.authConfig.provider === 'mock') {
    return new MockUserSessionUseCase();
  }
  const repo = new UserSessionUseCase();
  deferRelease(repo, context);
  return repo;
};

export const getUserSessionCacheRepository = (
  context: ApplicationContext,
): UserSessionCacheRepository => {
  if (context.config.get('dbMock')) {
    if (!mockUserSessionCacheRepository) {
      mockUserSessionCacheRepository = MockMongoRepository.getInstance(context);
    }
    return mockUserSessionCacheRepository;
  }
  const repo = UserSessionCacheMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

export const getStorageGateway = (_context: ApplicationContext): StorageGateway => {
  if (!storageGateway) {
    storageGateway = LocalStorageGateway;
  }
  return storageGateway;
};

export const getUserGroupGateway = async (
  context: ApplicationContext,
): Promise<UserGroupGateway> => {
  if (context.config.authConfig.provider === 'mock') {
    return new MockUserGroupGateway();
  } else if (context.config.authConfig.provider === 'okta') {
    if (!idpApiGateway) {
      try {
        idpApiGateway = new OktaUserGroupGateway();
        await idpApiGateway.init(context.config.userGroupGatewayConfig);
      } catch (originalError) {
        idpApiGateway = null;
        throw getCamsErrorWithStack(originalError, 'FACTORY', {
          camsStackInfo: {
            message: 'Identity provider API Gateway failed to initialize.',
            module: 'FACTORY',
          },
        });
      }
    }
    return idpApiGateway;
  }
  return null;
};

const getAcmsGateway = (context: ApplicationContext): AcmsGateway => {
  if (!acmsGateway) {
    acmsGateway = new AcmsGatewayImpl(context);
  }
  return acmsGateway;
};

export const getOfficeAssigneesRepository = (
  context: ApplicationContext,
): OfficeAssigneesRepository => {
  if (context.config.dbMock === true) {
    return MockMongoRepository.getInstance(context);
  }
  const repo = OfficeAssigneeMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

export const getQueueGateway = (_ignore: ApplicationContext): QueueGateway => {
  return StorageQueueGateway;
};

export const Factory = {
  getAcmsGateway,
  getAssignmentRepository,
  getAttorneyGateway,
  getAuthorizationGateway,
  getCaseDocketUseCase,
  getCaseNotesRepository,
  getCasesGateway,
  getCasesRepository,
  getCasesSyncStateRepo,
  getConsolidationOrdersRepository,
  getOfficeAssigneesRepository,
  getOfficesGateway,
  getOfficesRepository,
  getOfficeStaffSyncStateRepo,
  getOrdersGateway,
  getOrdersRepository,
  getOrderSyncStateRepo,
  getQueueGateway,
  getRuntimeStateRepository,
  getSqlConnection,
  getStorageGateway,
  getUserGroupGateway,
  getUserSessionCacheRepository,
  getUserSessionUseCase,
  getUsersRepository,
};

export default Factory;
