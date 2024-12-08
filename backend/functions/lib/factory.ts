import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { CasesInterface } from './use-cases/cases.interface';
import { ApplicationContext } from './adapters/types/basic';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import { DocumentDbConfig, IDbConfig } from './adapters/types/database';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';
import { DxtrCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.dxtr.gateway';
import { MockCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.mock.gateway';
import { ConnectionPool, config } from 'mssql';
import {
  CaseAssignmentRepository,
  CasesRepository,
  ConsolidationOrdersRepository,
  OfficesRepository,
  OrdersGateway,
  OrdersRepository,
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
import { MockOfficesRepository } from './testing/mock-gateways/mock.offices.repository';

export const getAttorneyGateway = (): AttorneyGatewayInterface => {
  return MockAttorneysGateway;
};

export const getCasesGateway = (applicationContext: ApplicationContext): CasesInterface => {
  if (applicationContext.config.get('dbMock')) {
    return new CasesLocalGateway();
  } else {
    return new CasesDxtrGateway();
  }
};

export const getAssignmentRepository = (
  applicationContext: ApplicationContext,
): CaseAssignmentRepository => {
  if (applicationContext.config.get('dbMock')) return new MockMongoRepository();
  return new CaseAssignmentMongoRepository(applicationContext);
};

export const getCosmosConfig = (applicationContext: ApplicationContext): DocumentDbConfig => {
  return applicationContext.config.get('cosmosConfig');
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

export const getOrdersGateway = (applicationContext: ApplicationContext): OrdersGateway => {
  if (applicationContext.config.get('dbMock')) {
    return new MockOrdersGateway();
  } else {
    return new DxtrOrdersGateway();
  }
};

export const getOfficesGateway = (applicationContext: ApplicationContext): OfficesGateway => {
  if (applicationContext.config.get('dbMock')) {
    return new MockOfficesGateway();
  } else {
    return new OfficesDxtrGateway();
  }
};

export const getOfficesRepository = (applicationContext: ApplicationContext): OfficesRepository => {
  if (applicationContext.config.authConfig.provider === 'mock') {
    return MockOfficesRepository;
  }
  return new OfficesMongoRepository(applicationContext);
};

// transfer orders
export const getOrdersRepository = (applicationContext: ApplicationContext): OrdersRepository => {
  if (applicationContext.config.get('dbMock')) return new MockMongoRepository();
  return new OrdersMongoRepository(applicationContext);
};

export const getConsolidationOrdersRepository = (
  applicationContext: ApplicationContext,
): ConsolidationOrdersRepository => {
  if (applicationContext.config.get('dbMock')) return new MockMongoRepository();
  return new ConsolidationOrdersMongoRepository(applicationContext);
};

export const getCasesRepository = (applicationContext: ApplicationContext): CasesRepository => {
  if (applicationContext.config.get('dbMock')) return new MockMongoRepository();
  return new CasesMongoRepository(applicationContext);
};

export const getRuntimeStateRepository = <T extends RuntimeState>(
  applicationContext: ApplicationContext,
): RuntimeStateRepository<T> => {
  if (applicationContext.config.get('dbMock')) return new MockMongoRepository();
  return new RuntimeStateMongoRepository<T>(applicationContext);
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
  if (context.config.get('dbMock')) return new MockMongoRepository();
  return new UserSessionCacheMongoRepository(context);
};

export const getStorageGateway = (_context: ApplicationContext): StorageGateway => {
  return LocalStorageGateway;
};

export const getUserGroupGateway = (_context: ApplicationContext): UserGroupGateway => {
  return OktaUserGroupGateway;
};

export const Factory = {
  getAttorneyGateway,
  getCasesGateway,
  getAssignmentRepository,
  getCosmosConfig,
  getCaseDocketUseCase,
  getSqlConnection,
  getOrdersGateway,
  getOfficesGateway,
  getOfficesRepository,
  getOrdersRepository,
  getConsolidationOrdersRepository,
  getCasesRepository,
  getRuntimeStateRepository,
  getAuthorizationGateway,
  getUserSessionUseCase,
  getUserSessionCacheRepository,
  getStorageGateway,
  getUserGroupGateway,
};
