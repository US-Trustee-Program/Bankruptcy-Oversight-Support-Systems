import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { AttorneyLocalGateway } from './adapters/gateways/attorneys.inmemory.gateway';
import { CasesInterface } from './use-cases/cases.interface';
import { CaseAssignmentRepositoryInterface } from './interfaces/case.assignment.repository.interface';
import { ApplicationContext } from './adapters/types/basic';
import { CasesLocalGateway } from './adapters/gateways/mock.cases.gateway';
import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import { CosmosConfig, IDbConfig } from './adapters/types/database';
import { CaseAssignmentCosmosDbRepository } from './adapters/gateways/case.assignment.cosmosdb.repository';
import CosmosClientHumble from './cosmos-humble-objects/cosmos-client-humble';
import FakeAssignmentsCosmosClientHumble from './cosmos-humble-objects/fake.assignments.cosmos-client-humble';
import FakeOrdersCosmosClientHumble from './cosmos-humble-objects/fake.orders.cosmos-client-humble';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';

import { DxtrCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.dxtr.gateway';
import { MockCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.mock.gateway';
import { ConnectionPool, config } from 'mssql';
import {
  OrdersGateway,
  OrdersRepository,
  RuntimeStateRepository,
} from './use-cases/gateways.types';
import { DxtrOrdersGateway } from './adapters/gateways/dxtr/orders.dxtr.gateway';
import { MockOrdersGateway } from './adapters/gateways/dxtr/mock.orders.gateway';
import { OfficesGatewayInterface } from './use-cases/offices/offices.gateway.interface';
import OfficesDxtrGateway from './adapters/gateways/dxtr/offices.gateway';
import { MockOfficesGateway } from './adapters/gateways/dxtr/mock.offices.gateway';
import { OrdersCosmosDbRepository } from './adapters/gateways/orders.cosmosdb.repository';
import FakeRuntimeStateCosmosClientHumble from './cosmos-humble-objects/fake.runtime.cosmos-client-humble';
import { RuntimeStateCosmosDbRepository } from './adapters/gateways/runtime-state.cosmosdb.repository';

export const getAttorneyGateway = (): AttorneyGatewayInterface => {
  return new AttorneyLocalGateway();
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
): CaseAssignmentRepositoryInterface => {
  return new CaseAssignmentCosmosDbRepository(applicationContext);
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

export const getOrdersCosmosDbClient = (
  applicationContext: ApplicationContext,
): CosmosClientHumble | FakeOrdersCosmosClientHumble => {
  if (applicationContext.config.get('dbMock')) {
    return new FakeOrdersCosmosClientHumble();
  } else {
    return new CosmosClientHumble(applicationContext.config);
  }
};

export const getCosmosConfig = (applicationContext: ApplicationContext): CosmosConfig => {
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

export const getOfficesGateway = (
  applicationContext: ApplicationContext,
): OfficesGatewayInterface => {
  if (applicationContext.config.get('dbMock')) {
    return new MockOfficesGateway();
  } else {
    return new OfficesDxtrGateway();
  }
};

export const getOrdersRepository = (applicationContext: ApplicationContext): OrdersRepository => {
  // TODO: Replace this with a mock repo.
  // if (applicationContext.config.get('dbMock')) return new MockOrdersCosmosDbRepository();
  return new OrdersCosmosDbRepository(applicationContext);
};

export const getRuntimeCosmosDbClient = (
  applicationContext: ApplicationContext,
): CosmosClientHumble | FakeRuntimeStateCosmosClientHumble => {
  if (applicationContext.config.get('dbMock')) {
    return new FakeRuntimeStateCosmosClientHumble();
  } else {
    return new CosmosClientHumble(applicationContext.config);
  }
};

export const getRuntimeStateRepository = (
  applicationContext: ApplicationContext,
): RuntimeStateRepository => {
  return new RuntimeStateCosmosDbRepository(applicationContext);
};
