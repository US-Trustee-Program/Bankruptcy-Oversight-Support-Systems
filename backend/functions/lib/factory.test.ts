import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import OfficesDxtrGateway from './adapters/gateways/dxtr/offices.dxtr.gateway';
import { DxtrOrdersGateway } from './adapters/gateways/dxtr/orders.dxtr.gateway';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import { RuntimeStateCosmosDbRepository } from './adapters/gateways/runtime-state.cosmosdb.repository';
import { ApplicationContext } from './adapters/types/basic';
import CosmosClientHumble from './cosmos-humble-objects/cosmos-client-humble';
import FakeAssignmentsCosmosClientHumble from './cosmos-humble-objects/fake.assignments.cosmos-client-humble';
import {
  getAssignmentRepository,
  getAssignmentsCosmosDbClient,
  getCaseDocketUseCase,
  getCasesGateway,
  getOfficesGateway,
  getOrdersGateway,
  getOrdersRepository,
  getRuntimeStateRepository,
} from './factory';
import { createMockApplicationContext } from './testing/testing-utilities';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';
import { MockOrdersGateway } from './testing/mock-gateways/mock.orders.gateway';
import { MockOfficesGateway } from './testing/mock-gateways/mock.offices.gateway';
import { CaseAssignmentCosmosMongoDbRepository } from './adapters/gateways/case.assignment.cosmosdb.mongo.repository';
import { OrdersCosmosDbMongoRepository } from './adapters/gateways/orders.cosmosdb.mongo.repository';
import { MockOrdersRepository } from './testing/mock-gateways/mock-orders.repository';

describe('Factory functions', () => {
  let dbContext: ApplicationContext;
  let mockDbContext: ApplicationContext;

  beforeAll(async () => {
    dbContext = await createMockApplicationContext({
      env: {
        DATABASE_MOCK: 'false',
        COSMOS_ENDPOINT: 'https://cosmos-ustp-cams-dev.documents.azure.us:443/',
      },
    });
    mockDbContext = await createMockApplicationContext();
  });

  test('getAttorneyGateway', async () => {
    const obj = getCaseDocketUseCase(dbContext);
    expect(obj).toBeInstanceOf(CaseDocketUseCase);
  });

  test('getCasesGateway', async () => {
    const mockObj = getCasesGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(CasesLocalGateway);

    const obj = getCasesGateway(dbContext);
    expect(obj).toBeInstanceOf(CasesDxtrGateway);
  });

  test('getAssignmentRepository', async () => {
    const obj = getAssignmentRepository(dbContext);
    expect(obj).toBeInstanceOf(CaseAssignmentCosmosMongoDbRepository);
  });

  test('getAssignmentsCosmosDbClient', async () => {
    const mockObj = getAssignmentsCosmosDbClient(mockDbContext);
    expect(mockObj).toBeInstanceOf(FakeAssignmentsCosmosClientHumble);

    const obj = getAssignmentsCosmosDbClient(dbContext);
    expect(obj).toBeInstanceOf(CosmosClientHumble);
  });

  test('getCaseDocketUseCase', async () => {
    const mockObj = getCaseDocketUseCase(mockDbContext);
    expect(mockObj).toBeInstanceOf(CaseDocketUseCase);

    const obj = getCaseDocketUseCase(dbContext);
    expect(obj).toBeInstanceOf(CaseDocketUseCase);
  });

  test('getOrdersGateway', async () => {
    const mockObj = getOrdersGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockOrdersGateway);

    const obj = getOrdersGateway(dbContext);
    expect(obj).toBeInstanceOf(DxtrOrdersGateway);
  });

  test('getOfficesGateway', async () => {
    const mockObj = getOfficesGateway(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockOfficesGateway);

    const obj = getOfficesGateway(dbContext);
    expect(obj).toBeInstanceOf(OfficesDxtrGateway);
  });

  test('getOrdersRepository', async () => {
    const mockObj = getOrdersRepository(mockDbContext);
    expect(mockObj).toBeInstanceOf(MockOrdersRepository);

    const obj = getOrdersRepository(dbContext);
    expect(obj).toBeInstanceOf(OrdersCosmosDbMongoRepository);
  });

  test('getRuntimeStateRepository', async () => {
    const obj = getRuntimeStateRepository(dbContext);
    expect(obj).toBeInstanceOf(RuntimeStateCosmosDbRepository);
  });
});
