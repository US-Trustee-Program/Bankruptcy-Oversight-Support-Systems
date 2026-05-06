import { vi, beforeAll, beforeEach, describe, test, expect } from 'vitest';
import factory from './factory';
import { ApplicationContext } from './adapters/types/basic';
import OktaGateway from './adapters/gateways/okta/okta-gateway';
import MockOpenIdConnectGateway from './testing/mock-gateways/mock-oauth2-gateway';
import { MockUserSessionUseCase } from './testing/mock-gateways/mock-user-session-use-case';
import { UserSessionUseCase } from './use-cases/user-session/user-session';
import { createMockApplicationContext } from './testing/testing-utilities';
import CasesDxtrGateway from './adapters/gateways/dxtr/cases.dxtr.gateway';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';
import DxtrOrdersGateway from './adapters/gateways/dxtr/orders.dxtr.gateway';
import OfficesDxtrGateway from './adapters/gateways/dxtr/offices.dxtr.gateway';
import { CaseAssignmentMongoRepository } from './adapters/gateways/mongo/case-assignment.mongo.repository';
import { CaseNotesMongoRepository } from './adapters/gateways/mongo/case-notes.mongo.repository';
import { TrusteeNotesMongoRepository } from './adapters/gateways/mongo/trustee-notes.mongo.repository';
import { OrdersMongoRepository } from './adapters/gateways/mongo/orders.mongo.repository';
import ConsolidationOrdersMongoRepository from './adapters/gateways/mongo/consolidations.mongo.repository';
import { CasesMongoRepository } from './adapters/gateways/mongo/cases.mongo.repository';
import { ArchivedCasesMongoRepository } from './adapters/gateways/mongo/archived-cases.mongo.repository';
import { UserSessionCacheMongoRepository } from './adapters/gateways/mongo/user-session-cache.mongo.repository';
import { RuntimeStateMongoRepository } from './adapters/gateways/mongo/runtime-state.mongo.repository';
import { UsersMongoRepository } from './adapters/gateways/mongo/user.repository';
import { OfficesMongoRepository } from './adapters/gateways/mongo/offices.mongo.repository';
import { OfficeAssigneeMongoRepository } from './adapters/gateways/mongo/office-assignee.mongo.repository';
import { UserGroupsMongoRepository } from './adapters/gateways/mongo/user-groups.mongo.repository';
import { TrusteesMongoRepository } from './adapters/gateways/mongo/trustees.mongo.repository';
import { TrusteeAppointmentsMongoRepository } from './adapters/gateways/mongo/trustee-appointments.mongo.repository';
import { TrusteeAssistantsMongoRepository } from './adapters/gateways/mongo/trustee-assistants.mongo.repository';
import { ListsMongoRepository } from './adapters/gateways/mongo/lists.mongo.repository';
import { TrusteeUpcomingKeyDatesMongoRepository } from './adapters/gateways/mongo/trustee-upcoming-key-dates.mongo.repository';
import { TrusteeMatchVerificationMongoRepository } from './adapters/gateways/mongo/trustee-match-verification.mongo.repository';
import { TrusteeProfessionalIdsMongoRepository } from './adapters/gateways/mongo/trustee-professional-ids.mongo.repository';
import { AzureBlobObjectStorageGateway } from './adapters/gateways/storage/azure-blob-object-storage.gateway';
import { AcmsGatewayImpl } from './adapters/gateways/acms/acms.gateway';
import { AtsGatewayImpl } from './adapters/gateways/ats/ats.gateway';
import { ApiToDataflowsGatewayImpl } from './adapters/gateways/api-to-dataflows/api-to-dataflows.gateway';

describe('Factory', () => {
  let dbContext: ApplicationContext;

  beforeAll(async () => {
    dbContext = await createMockApplicationContext({
      env: {
        CAMS_LOGIN_PROVIDER: 'okta',
        DATABASE_MOCK: 'false',
        COSMOS_ENDPOINT: 'https://cosmos-ustp-cams-dev.documents.azure.us:443/',
        CAMS_USER_GROUP_GATEWAY_CONFIG:
          'url=https://fake.url|clientId=mock|keyId=mock|privateKey={"foo": "bar"}}',
      },
    });
  });

  function makeOktaUserGroupContext(base: ApplicationContext): ApplicationContext {
    const ctx = { ...base };
    ctx.config.authConfig.provider = 'okta';
    ctx.config.userGroupGatewayConfig.provider = 'okta';
    ctx.config.userGroupGatewayConfig.clientId = 'mock';
    ctx.config.userGroupGatewayConfig.keyId = 'mock';
    ctx.config.userGroupGatewayConfig.url = 'https://fake.url';
    ctx.config.userGroupGatewayConfig.privateKey = '{}';
    return ctx;
  }

  test.each([
    ['getCasesGateway', (f, ctx) => f.getCasesGateway(ctx), CasesDxtrGateway],
    ['getCaseDocketUseCase', (f, ctx) => f.getCaseDocketUseCase(ctx), CaseDocketUseCase],
    ['getOrdersGateway', (f, ctx) => f.getOrdersGateway(ctx), DxtrOrdersGateway],
    ['getOfficesGateway', (f, ctx) => f.getOfficesGateway(ctx), OfficesDxtrGateway],
    [
      'getAssignmentRepository',
      (f, ctx) => f.getAssignmentRepository(ctx),
      CaseAssignmentMongoRepository,
    ],
    ['getCaseNotesRepository', (f, ctx) => f.getCaseNotesRepository(ctx), CaseNotesMongoRepository],
    [
      'getTrusteeNotesRepository',
      (f, ctx) => f.getTrusteeNotesRepository(ctx),
      TrusteeNotesMongoRepository,
    ],
    ['getOrdersRepository', (f, ctx) => f.getOrdersRepository(ctx), OrdersMongoRepository],
    [
      'getConsolidationOrdersRepository',
      (f, ctx) => f.getConsolidationOrdersRepository(ctx),
      ConsolidationOrdersMongoRepository,
    ],
    ['getCasesRepository', (f, ctx) => f.getCasesRepository(ctx), CasesMongoRepository],
    [
      'getArchivedCasesRepository',
      (f, ctx) => f.getArchivedCasesRepository(ctx),
      ArchivedCasesMongoRepository,
    ],
    [
      'getUserSessionCacheRepository',
      (f, ctx) => f.getUserSessionCacheRepository(ctx),
      UserSessionCacheMongoRepository,
    ],
    [
      'getRuntimeStateRepository',
      (f, ctx) => f.getRuntimeStateRepository(ctx),
      RuntimeStateMongoRepository,
    ],
    [
      'getOrderSyncStateRepo',
      (f, ctx) => f.getOrderSyncStateRepo(ctx),
      RuntimeStateMongoRepository,
    ],
    [
      'getOfficeStaffSyncStateRepo',
      (f, ctx) => f.getOfficeStaffSyncStateRepo(ctx),
      RuntimeStateMongoRepository,
    ],
    [
      'getCasesSyncStateRepo',
      (f, ctx) => f.getCasesSyncStateRepo(ctx),
      RuntimeStateMongoRepository,
    ],
    [
      'getPhoneticBackfillStateRepo',
      (f, ctx) => f.getPhoneticBackfillStateRepo(ctx),
      RuntimeStateMongoRepository,
    ],
    [
      'getCaseAppointmentDateBackfillStateRepo',
      (f, ctx) => f.getCaseAppointmentDateBackfillStateRepo(ctx),
      RuntimeStateMongoRepository,
    ],
    [
      'getTrusteeAppointmentsSyncStateRepo',
      (f, ctx) => f.getTrusteeAppointmentsSyncStateRepo(ctx),
      RuntimeStateMongoRepository,
    ],
    [
      'getTrusteeNotesMetricsSyncStateRepo',
      (f, ctx) => f.getTrusteeNotesMetricsSyncStateRepo(ctx),
      RuntimeStateMongoRepository,
    ],
    ['getUsersRepository', (f, ctx) => f.getUsersRepository(ctx), UsersMongoRepository],
    ['getOfficesRepository', (f, ctx) => f.getOfficesRepository(ctx), OfficesMongoRepository],
    [
      'getOfficeAssigneesRepository',
      (f, ctx) => f.getOfficeAssigneesRepository(ctx),
      OfficeAssigneeMongoRepository,
    ],
    [
      'getUserGroupsRepository',
      (f, ctx) => f.getUserGroupsRepository(ctx),
      UserGroupsMongoRepository,
    ],
    ['getTrusteesRepository', (f, ctx) => f.getTrusteesRepository(ctx), TrusteesMongoRepository],
    [
      'getTrusteeAppointmentsRepository',
      (f, ctx) => f.getTrusteeAppointmentsRepository(ctx),
      TrusteeAppointmentsMongoRepository,
    ],
    [
      'getTrusteeAssistantsRepository',
      (f, ctx) => f.getTrusteeAssistantsRepository(ctx),
      TrusteeAssistantsMongoRepository,
    ],
    ['getListsGateway', (f, ctx) => f.getListsGateway(ctx), ListsMongoRepository],
    [
      'getTrusteeUpcomingKeyDatesRepository',
      (f, ctx) => f.getTrusteeUpcomingKeyDatesRepository(ctx),
      TrusteeUpcomingKeyDatesMongoRepository,
    ],
    [
      'getTrusteeMatchVerificationRepository',
      (f, ctx) => f.getTrusteeMatchVerificationRepository(ctx),
      TrusteeMatchVerificationMongoRepository,
    ],
    [
      'getTrusteeProfessionalIdsRepository',
      (f, ctx) => f.getTrusteeProfessionalIdsRepository(ctx),
      TrusteeProfessionalIdsMongoRepository,
    ],
    [
      'getObjectStorageGateway',
      (f, ctx) => f.getObjectStorageGateway(ctx),
      AzureBlobObjectStorageGateway,
    ],
    ['getAcmsGateway', (f, ctx) => f.getAcmsGateway(ctx), AcmsGatewayImpl],
    ['getAtsGateway', (f, ctx) => f.getAtsGateway(ctx), AtsGatewayImpl],
    [
      'getApiToDataflowsGateway',
      (f, ctx) => f.getApiToDataflowsGateway(ctx),
      ApiToDataflowsGatewayImpl,
    ],
  ] as const)('%s returns an instance of the expected type', (_label, getter, ExpectedType) => {
    expect(getter(factory, dbContext)).toBeInstanceOf(ExpectedType);
  });

  test('getStorageGateway returns a defined instance', () => {
    expect(factory.getStorageGateway(dbContext)).toBeDefined();
  });

  test('getAuthorizationGateway returns OktaGateway, MockOpenIdConnectGateway, or null by provider', () => {
    const oktaCtx = { ...dbContext };
    oktaCtx.config.authConfig.provider = 'okta';
    expect(factory.getAuthorizationGateway(oktaCtx)).toEqual(OktaGateway);

    const mockCtx = { ...dbContext };
    mockCtx.config.authConfig.provider = 'mock';
    expect(factory.getAuthorizationGateway(mockCtx)).toEqual(MockOpenIdConnectGateway);

    const unknownCtx = { ...dbContext };
    unknownCtx.config.authConfig.provider = 'unknown';
    expect(factory.getAuthorizationGateway(unknownCtx)).toBeNull();
  });

  describe('getUserGroupGateway', () => {
    let f;
    let OktaHumbleClass;
    let OktaUserGroupGatewayClass;
    let MockUserGroupGatewayClass;

    beforeEach(async () => {
      vi.resetModules();
      f = (await import('./factory')).default;
      OktaHumbleClass = (await import('./humble-objects/okta-humble')).default;
      OktaUserGroupGatewayClass = (await import('./adapters/gateways/okta/okta-user-group-gateway'))
        .default;
      MockUserGroupGatewayClass = (await import('./testing/mock-gateways/mock-user-group-gateway'))
        .default;
    });

    test('returns OktaUserGroupGateway for okta provider', async () => {
      const ctx = makeOktaUserGroupContext(dbContext);
      vi.spyOn(OktaHumbleClass.prototype, 'init').mockImplementation(vi.fn());
      expect(await f.getUserGroupGateway(ctx)).toBeInstanceOf(OktaUserGroupGatewayClass);
    });

    test('returns MockUserGroupGateway for mock provider', async () => {
      const ctx = { ...dbContext };
      ctx.config.authConfig.provider = 'mock';
      ctx.config.userGroupGatewayConfig.provider = 'mock';
      expect(await f.getUserGroupGateway(ctx)).toBeInstanceOf(MockUserGroupGatewayClass);
    });

    test('throws when init fails', async () => {
      const ctx = makeOktaUserGroupContext(dbContext);
      vi.spyOn(OktaUserGroupGatewayClass.prototype, 'init').mockRejectedValue(
        new Error('init failed'),
      );
      await expect(f.getUserGroupGateway(ctx)).rejects.toThrow();
    });

    test('throws for unsupported provider', async () => {
      const ctx = { ...dbContext };
      ctx.config.authConfig.provider = 'unsupported';
      await expect(f.getUserGroupGateway(ctx)).rejects.toThrow();
    });
  });

  test('getUserSessionUseCase returns UserSessionUseCase or MockUserSessionUseCase by provider', () => {
    const oktaCtx = { ...dbContext };
    oktaCtx.config.authConfig.provider = 'okta';
    expect(factory.getUserSessionUseCase(oktaCtx)).toBeInstanceOf(UserSessionUseCase);

    const mockCtx = { ...dbContext };
    mockCtx.config.authConfig.provider = 'mock';
    expect(factory.getUserSessionUseCase(mockCtx)).toBeInstanceOf(MockUserSessionUseCase);
  });
});
