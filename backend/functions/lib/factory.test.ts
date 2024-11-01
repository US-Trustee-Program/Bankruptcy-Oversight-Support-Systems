import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import OfficesDxtrGateway from './adapters/gateways/dxtr/offices.dxtr.gateway';
import { DxtrOrdersGateway } from './adapters/gateways/dxtr/orders.dxtr.gateway';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import { RuntimeStateMongoRepository } from './adapters/gateways/mongo/runtime-state.mongo.repository';
import { ApplicationContext } from './adapters/types/basic';
import {
  getAssignmentRepository,
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
import { CaseAssignmentMongoRepository } from './adapters/gateways/mongo/case-assignment.mongo.repository';
import { OrdersMongoRepository } from './adapters/gateways/mongo/orders.mongo.repository';
import { MockMongoRepository } from './testing/mock-gateways/mock-mongo.repository';

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
    expect(obj).toBeInstanceOf(CaseAssignmentMongoRepository);
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
    expect(mockObj).toBeInstanceOf(MockMongoRepository);

    const obj = getOrdersRepository(dbContext);
    expect(obj).toBeInstanceOf(OrdersMongoRepository);
  });

  test('getRuntimeStateRepository', async () => {
    const obj = getRuntimeStateRepository(dbContext);
    expect(obj).toBeInstanceOf(RuntimeStateMongoRepository);
  });
});
