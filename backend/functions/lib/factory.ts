import { AttorneyGatewayInterface } from './use-cases/attorney.gateway.interface';
import { AttorneyLocalGateway } from './adapters/gateways/attorneys.inmemory.gateway';
import { CasesInterface } from './use-cases/cases.interface';
import { CaseAssignmentRepositoryInterface } from './interfaces/case.assignment.repository.interface';
import { ApplicationContext } from './adapters/types/basic';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import { CosmosConfig, IDbConfig } from './adapters/types/database';
import { CaseAssignmentCosmosDbRepository } from './adapters/gateways/case.assignment.cosmosdb.repository';
import CosmosClientHumble from './cosmos-humble-objects/cosmos-client-humble';
import FakeAssignmentsCosmosClientHumble from './cosmos-humble-objects/fake.assignments.cosmos-client-humble';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';

import { DxtrCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.dxtr.gateway';
import { MockCaseDocketGateway } from './adapters/gateways/dxtr/case-docket.mock.gateway';
import { ConnectionPool, config } from 'mssql';
import {
  CasesRepository,
  ConsolidationOrdersRepository,
  DocumentRepository,
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
import { RuntimeStateCosmosDbRepository } from './adapters/gateways/runtime-state.cosmosdb.repository';
import { CasesCosmosDbRepository } from './adapters/gateways/cases.cosmosdb.repository';
import ConsolidationOrdersCosmosDbRepository from './adapters/gateways/consolidations.cosmosdb.repository';
import { MockHumbleClient } from './testing/mock.cosmos-client-humble';
import { CosmosDbRepository } from './adapters/gateways/cosmos/cosmos.repository';
import { OpenIdConnectGateway } from './adapters/types/authorization';
import OktaGateway from './adapters/gateways/okta/okta-gateway';

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

export const getCosmosDbClient = (
  applicationContext: ApplicationContext,
): CosmosClientHumble | MockHumbleClient => {
  if (applicationContext.config.get('dbMock')) {
    return new MockHumbleClient();
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
  return new OrdersCosmosDbRepository(applicationContext);
};

export const getConsolidationOrdersRepository = (
  applicationContext: ApplicationContext,
): ConsolidationOrdersRepository => {
  return new ConsolidationOrdersCosmosDbRepository(applicationContext);
};

export const getCasesRepository = (applicationContext: ApplicationContext): CasesRepository => {
  return new CasesCosmosDbRepository(applicationContext);
};

export const getRuntimeStateRepository = (
  applicationContext: ApplicationContext,
): RuntimeStateRepository => {
  return new RuntimeStateCosmosDbRepository(applicationContext);
};

export const getCosmosDbCrudRepository = <T>(
  context: ApplicationContext,
  containerName: string,
  moduleName: string,
): DocumentRepository<T> => {
  return new CosmosDbRepository<T>(context, containerName, moduleName);
};

export const getAuthorizationGateway = (provider: string): OpenIdConnectGateway | null => {
  if (provider === 'okta') return OktaGateway;

  const hardStop: OpenIdConnectGateway = {
    verifyToken: (_token: string) => {
      throw new Error('Bad gateway');
    },
  };
  return hardStop;
};
