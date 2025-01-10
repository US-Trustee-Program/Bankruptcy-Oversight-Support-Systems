import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { CasesInterface } from './use-cases/cases.interface';
import { ApplicationContext } from './adapters/types/basic';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import { IDbConfig } from './adapters/types/database';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';
import { DxtrCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.dxtr.gateway';
import { MockCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.mock.gateway';
import { ConnectionPool, config } from 'mssql';
import {
  AcmsGateway,
  CaseAssignmentRepository,
  CasesRepository,
  ConsolidationOrdersRepository,
  OfficesRepository,
  OfficeStaffSyncState,
  OrdersGateway,
  OrdersRepository,
  OrderSyncState,
  RuntimeState,
  RuntimeStateRepository,
  UserSessionCacheRepository,
} from './use-cases/gateways.types';
import { DxtrOrdersGateway } from './adapters/gateways/dxtr/orders.dxtr.gateway';
import { OfficesGateway } from './use-cases/offices/offices.types';
import OfficesDxtrGateway from './adapters/gateways/dxtr/offices.dxtr.gateway';
import { OpenIdConnectGateway, UserGroupGateway } from './adapters/types/authorization';
import OktaGateway from './adapters/gateways/okta/okta-gateway';
import { MockUserSessionUseCase } from './testing/mock-gateways/mock-user-session-use-case';
import MockOpenIdConnectGateway from './testing/mock-gateways/mock-oauth2-gateway';
import { StorageGateway } from './adapters/types/storage';
import LocalStorageGateway from './adapters/gateways/storage/local-storage-gateway';
import MockAttorneysGateway from './testing/mock-gateways/mock-attorneys.gateway';
import { MockOrdersGateway } from './testing/mock-gateways/mock.orders.gateway';
import { MockOfficesGateway } from './testing/mock-gateways/mock.offices.gateway';
import OktaUserGroupGateway from './adapters/gateways/okta/okta-user-group-gateway';
import { UserSessionUseCase } from './use-cases/user-session/user-session';
import { OfficesMongoRepository } from './adapters/gateways/mongo/offices.mongo.repository';
import { CaseAssignmentMongoRepository } from './adapters/gateways/mongo/case-assignment.mongo.repository';
import { OrdersMongoRepository } from './adapters/gateways/mongo/orders.mongo.repository';
import { CasesMongoRepository } from './adapters/gateways/mongo/cases.mongo.repository';
import ConsolidationOrdersMongoRepository from './adapters/gateways/mongo/consolidations.mongo.repository';
import { MockMongoRepository } from './testing/mock-gateways/mock-mongo.repository';
import { RuntimeStateMongoRepository } from './adapters/gateways/mongo/runtime-state.mongo.repository';
import { UserSessionCacheMongoRepository } from './adapters/gateways/mongo/user-session-cache.mongo.repository';
import { AcmsGatewayImpl } from './adapters/gateways/acms/acms.gateway';
import { deferRelease } from './deferrable/defer-release';

let casesGateway: CasesInterface;
let ordersGateway: OrdersGateway;
let storageGateway: StorageGateway;
let acmsGateway: AcmsGateway;

let orderSyncStateRepo: RuntimeStateRepository<OrderSyncState>;
let officeStaffSyncStateRepo: RuntimeStateRepository<OfficeStaffSyncState>;

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
  if (context.config.get('dbMock')) return new MockMongoRepository();
  const repo = CaseAssignmentMongoRepository.getInstance(context);
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
  if (context.config.get('dbMock')) {
    if (!mockOrdersRepository) {
      mockOrdersRepository = MockMongoRepository.getInstance(context);
    }
    return mockOrdersRepository;
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
  if (context.config.get('dbMock')) return new MockMongoRepository();
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

export const getAuthorizationGateway = (context: ApplicationContext): OpenIdConnectGateway => {
  if (context.config.authConfig.provider === 'okta') return OktaGateway;
  if (context.config.authConfig.provider === 'mock') return MockOpenIdConnectGateway;
  return null;
};

export const getUserSessionUseCase = (context: ApplicationContext) => {
  if (context.config.authConfig.provider === 'mock') {
    return new MockUserSessionUseCase();
  }
  return new UserSessionUseCase();
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

export const getUserGroupGateway = (_context: ApplicationContext): UserGroupGateway => {
  return OktaUserGroupGateway;
};

const getAcmsGateway = (context: ApplicationContext): AcmsGateway => {
  if (!acmsGateway) {
    acmsGateway = new AcmsGatewayImpl(context);
  }
  return acmsGateway;
};

export const Factory = {
  getAcmsGateway,
  getAttorneyGateway,
  getCasesGateway,
  getAssignmentRepository,
  getCaseDocketUseCase,
  getSqlConnection,
  getOrdersGateway,
  getOfficesGateway,
  getOfficesRepository,
  getOrdersRepository,
  getConsolidationOrdersRepository,
  getCasesRepository,
  getRuntimeStateRepository,
  getOrderSyncStateRepo,
  getOfficeStaffSyncStateRepo,
  getAuthorizationGateway,
  getUserSessionUseCase,
  getUserSessionCacheRepository,
  getStorageGateway,
  getUserGroupGateway,
};

export default Factory;
