import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { CasesInterface } from './use-cases/cases.interface';
import { ApplicationContext } from './adapters/types/basic';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import { DocumentDbConfig, IDbConfig } from './adapters/types/database';
import CosmosClientHumble from './cosmos-humble-objects/cosmos-client-humble';
import FakeAssignmentsCosmosClientHumble from './cosmos-humble-objects/fake.assignments.cosmos-client-humble';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';
import { DxtrCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.dxtr.gateway';
import { MockCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.mock.gateway';
import { ConnectionPool, config } from 'mssql';
import {
  CasesRepository,
  ConsolidationOrdersRepository,
  OfficesRepository,
  OrdersGateway,
  OrdersRepository,
  RuntimeStateRepository,
} from './use-cases/gateways.types';
import { DxtrOrdersGateway } from './adapters/gateways/dxtr/orders.dxtr.gateway';
import { OfficesGateway } from './use-cases/offices/offices.types';
import OfficesDxtrGateway from './adapters/gateways/dxtr/offices.dxtr.gateway';
import { RuntimeStateCosmosDbRepository } from './adapters/gateways/runtime-state.cosmosdb.repository';
import { MockHumbleClient } from './testing/mock.cosmos-client-humble';
import { OpenIdConnectGateway, UserGroupGateway } from './adapters/types/authorization';
import OktaGateway from './adapters/gateways/okta/okta-gateway';
import { UserSessionCacheRepository } from './adapters/gateways/user-session-cache.repository';
import { UserSessionCacheCosmosDbRepository } from './adapters/gateways/user-session-cache.cosmosdb.repository';
import { MockUserSessionUseCase } from './testing/mock-gateways/mock-user-session-use-case';
import MockOpenIdConnectGateway from './testing/mock-gateways/mock-oauth2-gateway';
import { StorageGateway } from './adapters/types/storage';
import LocalStorageGateway from './adapters/gateways/storage/local-storage-gateway';
import MockAttorneysGateway from './testing/mock-gateways/mock-attorneys.gateway';
import { MockOrdersGateway } from './testing/mock-gateways/mock.orders.gateway';
import { MockOfficesGateway } from './testing/mock-gateways/mock.offices.gateway';
import OktaUserGroupGateway from './adapters/gateways/okta/okta-user-group-gateway';
import { UserSessionUseCase } from './use-cases/user-session/user-session';
import { MockOfficesRepository } from './testing/mock-gateways/mock-offices.repository';
import { OfficesCosmosMongoDbRepository } from './adapters/gateways/offices.cosmosdb.mongo.repository';
import { CaseAssignmentCosmosMongoDbRepository } from './adapters/gateways/case.assignment.cosmosdb.mongo.repository';
import { OrdersCosmosDbMongoRepository } from './adapters/gateways/orders.cosmosdb.mongo.repository';
import { CasesCosmosMongoDbRepository } from './adapters/gateways/cases.cosmosdb.mongo.repository';
import ConsolidationOrdersCosmosMongoDbRepository from './adapters/gateways/consolidations.cosmosdb.mongo.repository';
import { MockMongoRepository } from './testing/mock-gateways/mock-mongo.repository';

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
): CaseAssignmentCosmosMongoDbRepository => {
  // return new CaseAssignmentCosmosDbRepository(applicationContext);
  return new CaseAssignmentCosmosMongoDbRepository(applicationContext);
};

export const getAssignmentsCosmosDbClient = (
  applicationContext: ApplicationContext,
): CosmosClientHumble | FakeAssignmentsCosmosClientHumble => {
  if (applicationContext.config.get('dbMock')) {
    return new FakeAssignmentsCosmosClientHumble();
  } else {
    return new CosmosClientHumble(applicationContext.config);
  }
};

export const getCosmosDbClient = (
  applicationContext: ApplicationContext,
): CosmosClientHumble | MockHumbleClient => {
  if (applicationContext.config.get('dbMock')) {
    return new MockHumbleClient();
  } else {
    return new CosmosClientHumble(applicationContext.config);
  }
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
    return new MockOfficesRepository();
  }
  return new OfficesCosmosMongoDbRepository(applicationContext);
};

// transfer orders
export const getOrdersRepository = (applicationContext: ApplicationContext): OrdersRepository => {
  if (applicationContext.config.get('dbMock')) return new MockMongoRepository();
  return new OrdersCosmosDbMongoRepository(applicationContext);
};

export const getConsolidationOrdersRepository = (
  applicationContext: ApplicationContext,
): ConsolidationOrdersRepository => {
  if (applicationContext.config.get('dbMock')) return new MockMongoRepository();
  return new ConsolidationOrdersCosmosMongoDbRepository(applicationContext);
};

export const getCasesRepository = (applicationContext: ApplicationContext): CasesRepository => {
  if (applicationContext.config.get('dbMock')) return new MockMongoRepository();
  return new CasesCosmosMongoDbRepository(applicationContext);
};

export const getRuntimeStateRepository = (
  applicationContext: ApplicationContext,
): RuntimeStateRepository => {
  if (applicationContext.config.get('dbMock')) return new MockMongoRepository();
  return new RuntimeStateCosmosDbRepository(applicationContext);
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
  return new UserSessionCacheCosmosDbRepository(context);
};

export const getStorageGateway = (_context: ApplicationContext): StorageGateway => {
  return LocalStorageGateway;
};

export const getUserGroupGateway = (_context: ApplicationContext): UserGroupGateway => {
  return OktaUserGroupGateway;
};
