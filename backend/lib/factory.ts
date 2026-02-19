import { CasesInterface } from './use-cases/cases/cases.interface';
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
  AtsGateway,
  CaseAssignmentRepository,
  CaseNotesRepository,
  CasesRepository,
  CasesSyncState,
  ConsolidationOrdersRepository,
  ListsRepository,
  OfficeAssigneesRepository,
  OfficesRepository,
  OfficeStaffSyncState,
  OrdersGateway,
  OrdersRepository,
  OrderSyncState,
  PhoneticBackfillState,
  RuntimeState,
  RuntimeStateRepository,
  TrusteeAppointmentsRepository,
  TrusteeAssistantsRepository,
  TrusteesRepository,
  UserGroupsRepository,
  UserSessionCacheRepository,
  UsersRepository,
} from './use-cases/gateways.types';
import DxtrOrdersGateway from './adapters/gateways/dxtr/orders.dxtr.gateway';
import { OfficesGateway } from './use-cases/offices/offices.types';
import OfficesDxtrGateway from './adapters/gateways/dxtr/offices.dxtr.gateway';
import {
  Initializer,
  OpenIdConnectGateway,
  UserGroupGateway,
  UserGroupGatewayConfig,
} from './adapters/types/authorization';
import OktaGateway from './adapters/gateways/okta/okta-gateway';
import { MockUserSessionUseCase } from './testing/mock-gateways/mock-user-session-use-case';
import MockOpenIdConnectGateway from './testing/mock-gateways/mock-oauth2-gateway';
import { StorageGateway } from './adapters/types/storage';
import LocalStorageGateway from './adapters/gateways/storage/local-storage-gateway';
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
import { AtsGatewayImpl } from './adapters/gateways/ats/ats.gateway';
import { MockAtsGateway } from './adapters/gateways/ats/ats.mock.gateway';
import { deferRelease } from './deferrable/defer-release';
import { CaseNotesMongoRepository } from './adapters/gateways/mongo/case-notes.mongo.repository';
import { UsersMongoRepository } from './adapters/gateways/mongo/user.repository';
import MockUserGroupGateway from './testing/mock-gateways/mock-user-group-gateway';
import { getCamsErrorWithStack } from './common-errors/error-utilities';
import { OfficeAssigneeMongoRepository } from './adapters/gateways/mongo/office-assignee.mongo.repository';
import { TrusteesMongoRepository } from './adapters/gateways/mongo/trustees.mongo.repository';
import { TrusteeAppointmentsMongoRepository } from './adapters/gateways/mongo/trustee-appointments.mongo.repository';
import { TrusteeAssistantsMongoRepository } from './adapters/gateways/mongo/trustee-assistants.mongo.repository';
import { ListsMongoRepository } from './adapters/gateways/mongo/lists.mongo.repository';
import { UserGroupsMongoRepository } from './adapters/gateways/mongo/user-groups.mongo.repository';
import {
  ServerConfigError,
  UNSUPPORTED_AUTHENTICATION_PROVIDER,
} from './common-errors/server-config-error';
import { ApiToDataflowsGateway } from './use-cases/gateways.types';
import { ApiToDataflowsGatewayImpl } from './adapters/gateways/api-to-dataflows/api-to-dataflows.gateway';

let casesGateway: CasesInterface;
let ordersGateway: OrdersGateway;
let storageGateway: StorageGateway;
let acmsGateway: AcmsGateway;
let atsGateway: AtsGateway;
let idpApiGateway: UserGroupGateway & Initializer<UserGroupGatewayConfig | ApplicationContext>;

let orderSyncStateRepo: RuntimeStateRepository<OrderSyncState>;
let casesSyncStateRepo: RuntimeStateRepository<CasesSyncState>;
let officeStaffSyncStateRepo: RuntimeStateRepository<OfficeStaffSyncState>;
let phoneticBackfillStateRepo: RuntimeStateRepository<PhoneticBackfillState>;
let usersRepository: UsersRepository;

let mockOrdersRepository: MockMongoRepository;
let mockConsolidationsRepository: MockMongoRepository;
let mockCasesRepository: MockMongoRepository;
let mockUserSessionCacheRepository: MockMongoRepository;

const getUserGroupsRepository = (context: ApplicationContext): UserGroupsRepository => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  const repo = UserGroupsMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

const getCasesGateway = (context: ApplicationContext): CasesInterface => {
  if (!casesGateway) {
    if (context.config.get('dbMock')) {
      casesGateway = new CasesLocalGateway();
    } else {
      casesGateway = new CasesDxtrGateway();
    }
  }
  return casesGateway;
};

const getAssignmentRepository = (context: ApplicationContext): CaseAssignmentRepository => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  const repo = CaseAssignmentMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

const getCaseNotesRepository = (context: ApplicationContext): CaseNotesRepository => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  const repo = CaseNotesMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

const getCaseDocketUseCase = (context: ApplicationContext): CaseDocketUseCase => {
  const gateway = context.config.get('dbMock')
    ? new MockCaseDocketGateway()
    : new DxtrCaseDocketGateway();
  return new CaseDocketUseCase(gateway);
};

const getSqlConnection = (databaseConfig: IDbConfig) => {
  // Reference https://github.com/tediousjs/node-mssql#readme
  // TODO We may want to refactor this to use non ConnectionPool connection object since we have moved to function app.
  return new ConnectionPool(databaseConfig as config);
};

const getOrdersGateway = (context: ApplicationContext): OrdersGateway => {
  if (!ordersGateway) {
    if (context.config.get('dbMock')) {
      ordersGateway = new MockOrdersGateway();
    } else {
      ordersGateway = new DxtrOrdersGateway();
    }
  }
  return ordersGateway;
};

const getOfficesGateway = (context: ApplicationContext): OfficesGateway => {
  if (context.config.get('dbMock')) {
    return new MockOfficesGateway();
  } else {
    return new OfficesDxtrGateway();
  }
};

const getOfficesRepository = (context: ApplicationContext): OfficesRepository => {
  if (context.config.authConfig.provider === 'mock') {
    return MockMongoRepository.getInstance(context);
  }
  const repo = OfficesMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

const getOrdersRepository = (context: ApplicationContext): OrdersRepository => {
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

const getConsolidationOrdersRepository = (
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

const getCasesRepository = (context: ApplicationContext): CasesRepository => {
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

const getRuntimeStateRepository = <T extends RuntimeState>(
  context: ApplicationContext,
): RuntimeStateRepository<T> => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  return new RuntimeStateMongoRepository<T>(context);
};

const getOrderSyncStateRepo = (
  context: ApplicationContext,
): RuntimeStateRepository<OrderSyncState> => {
  if (!orderSyncStateRepo) {
    orderSyncStateRepo = getRuntimeStateRepository<OrderSyncState>(context);
  }
  return orderSyncStateRepo;
};

const getOfficeStaffSyncStateRepo = (
  context: ApplicationContext,
): RuntimeStateRepository<OfficeStaffSyncState> => {
  if (!officeStaffSyncStateRepo) {
    officeStaffSyncStateRepo = getRuntimeStateRepository<OfficeStaffSyncState>(context);
  }
  return officeStaffSyncStateRepo;
};

const getCasesSyncStateRepo = (
  context: ApplicationContext,
): RuntimeStateRepository<CasesSyncState> => {
  if (!casesSyncStateRepo) {
    context.logger.info('FACTORY', 'Creating new cases sync state repo.');
    casesSyncStateRepo = getRuntimeStateRepository<CasesSyncState>(context);
  }
  context.logger.info('FACTORY', 'Returning cases sync state repo.');
  return casesSyncStateRepo;
};

const getPhoneticBackfillStateRepo = (
  context: ApplicationContext,
): RuntimeStateRepository<PhoneticBackfillState> => {
  if (!phoneticBackfillStateRepo) {
    phoneticBackfillStateRepo = getRuntimeStateRepository<PhoneticBackfillState>(context);
  }
  return phoneticBackfillStateRepo;
};

const getUsersRepository = (context: ApplicationContext): UsersRepository => {
  if (context.config.get('dbMock')) {
    return MockMongoRepository.getInstance(context);
  }

  if (!usersRepository) {
    usersRepository = new UsersMongoRepository(context);
    deferRelease(usersRepository, context);
  }
  return usersRepository;
};

const getAuthorizationGateway = (context: ApplicationContext): OpenIdConnectGateway => {
  if (context.config.authConfig.provider === 'okta') {
    return OktaGateway;
  }
  if (context.config.authConfig.provider === 'mock') {
    return MockOpenIdConnectGateway;
  }
  return null;
};

const getUserSessionUseCase = (context: ApplicationContext) => {
  if (context.config.authConfig.provider === 'mock') {
    return new MockUserSessionUseCase();
  }
  const repo = new UserSessionUseCase(context);
  deferRelease(repo, context);
  return repo;
};

const getUserSessionCacheRepository = (context: ApplicationContext): UserSessionCacheRepository => {
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

const getStorageGateway = (_context: ApplicationContext): StorageGateway => {
  if (!storageGateway) {
    storageGateway = LocalStorageGateway;
  }
  return storageGateway;
};

const getUserGroupGateway = async (context: ApplicationContext): Promise<UserGroupGateway> => {
  if (context.config.authConfig.provider === 'mock') {
    return new MockUserGroupGateway();
  } else {
    if (!idpApiGateway) {
      try {
        if (context.config.authConfig.provider === 'okta') {
          idpApiGateway = new OktaUserGroupGateway();
          await idpApiGateway.init(context.config.userGroupGatewayConfig);
        } else {
          throw new ServerConfigError('FACTORY', {
            message: UNSUPPORTED_AUTHENTICATION_PROVIDER,
          });
        }
      } catch (originalError) {
        idpApiGateway = null;
        throw getCamsErrorWithStack(originalError, 'FACTORY', {
          camsStackInfo: {
            module: 'FACTORY',
            message: 'Identity provider API Gateway failed to initialize.',
          },
        });
      }
    }
    return idpApiGateway;
  }
};

const getAcmsGateway = (context: ApplicationContext): AcmsGateway => {
  if (!acmsGateway) {
    acmsGateway = new AcmsGatewayImpl(context);
  }
  return acmsGateway;
};

const getAtsGateway = (context: ApplicationContext): AtsGateway => {
  if (!atsGateway) {
    if (context.config.get('dbMock')) {
      atsGateway = MockAtsGateway.getInstance();
    } else {
      atsGateway = new AtsGatewayImpl(context);
    }
  }
  return atsGateway;
};

const getOfficeAssigneesRepository = (context: ApplicationContext): OfficeAssigneesRepository => {
  if (context.config.dbMock === true) {
    return MockMongoRepository.getInstance(context);
  }
  const repo = OfficeAssigneeMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

const getTrusteesRepository = (context: ApplicationContext): TrusteesRepository => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  const repo = TrusteesMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

const getTrusteeAppointmentsRepository = (
  context: ApplicationContext,
): TrusteeAppointmentsRepository => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  const repo = TrusteeAppointmentsMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

const getTrusteeAssistantsRepository = (
  context: ApplicationContext,
): TrusteeAssistantsRepository => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  const repo = TrusteeAssistantsMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

const getListsGateway = (context: ApplicationContext): ListsRepository => {
  if (context.config.get('dbMock')) {
    return new MockMongoRepository();
  }
  const repo = ListsMongoRepository.getInstance(context);
  deferRelease(repo, context);
  return repo;
};

const getApiToDataflowsGateway = (context: ApplicationContext): ApiToDataflowsGateway => {
  return new ApiToDataflowsGatewayImpl(context);
};

const factory = {
  getAcmsGateway,
  getAtsGateway,
  getCasesGateway,
  getAssignmentRepository,
  getCaseNotesRepository,
  getCaseDocketUseCase,
  getSqlConnection,
  getOrdersGateway,
  getOfficeAssigneesRepository,
  getOfficesGateway,
  getOfficesRepository,
  getOrdersRepository,
  getConsolidationOrdersRepository,
  getCasesRepository,
  getRuntimeStateRepository,
  getOrderSyncStateRepo,
  getOfficeStaffSyncStateRepo,
  getCasesSyncStateRepo,
  getPhoneticBackfillStateRepo,
  getAuthorizationGateway,
  getUserSessionUseCase,
  getUserSessionCacheRepository,
  getStorageGateway,
  getUserGroupGateway,
  getUsersRepository,
  getTrusteesRepository,
  getTrusteeAppointmentsRepository,
  getTrusteeAssistantsRepository,
  getListsGateway,
  getUserGroupsRepository,
  getApiToDataflowsGateway,
};

export default factory;
