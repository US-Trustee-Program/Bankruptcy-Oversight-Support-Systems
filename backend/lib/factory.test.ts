import { vi, beforeAll, beforeEach, describe, test, expect } from 'vitest';
import factory from './factory';
import { ApplicationContext } from './adapters/types/basic';
import OktaGateway from './adapters/gateways/okta/okta-gateway';
import MockOpenIdConnectGateway from './testing/mock-gateways/mock-oauth2-gateway';
import { MockUserSessionUseCase } from './testing/mock-gateways/mock-user-session-use-case';
import { UserSessionUseCase } from './use-cases/user-session/user-session';
import { createMockApplicationContext } from './testing/testing-utilities';
import { CaseDocketUseCase } from './use-cases/case-docket/case-docket';
import { CasesLocalGateway } from './adapters/gateways/cases.local.gateway';
import { MockOrdersGateway } from './testing/mock-gateways/mock.orders.gateway';
import { MockOfficesGateway } from './testing/mock-gateways/mock.offices.gateway';
import { MockMongoRepository } from './testing/mock-gateways/mock-mongo.repository';
import { MockAtsGateway } from './adapters/gateways/ats/ats.mock.gateway';
import { AzureBlobObjectStorageGateway } from './adapters/gateways/storage/azure-blob-object-storage.gateway';
import { AcmsGatewayImpl } from './adapters/gateways/acms/acms.gateway';
import { ApiToDataflowsGatewayImpl } from './adapters/gateways/api-to-dataflows/api-to-dataflows.gateway';
import { OfficesMongoRepository } from './adapters/gateways/mongo/offices.mongo.repository';

describe('Factory', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
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
    ['getCasesGateway', (f, ctx) => f.getCasesGateway(ctx), CasesLocalGateway],
    ['getCaseDocketUseCase', (f, ctx) => f.getCaseDocketUseCase(ctx), CaseDocketUseCase],
    ['getOrdersGateway', (f, ctx) => f.getOrdersGateway(ctx), MockOrdersGateway],
    ['getOfficesGateway', (f, ctx) => f.getOfficesGateway(ctx), MockOfficesGateway],
    ['getAssignmentRepository', (f, ctx) => f.getAssignmentRepository(ctx), MockMongoRepository],
    ['getCaseNotesRepository', (f, ctx) => f.getCaseNotesRepository(ctx), MockMongoRepository],
    [
      'getTrusteeNotesRepository',
      (f, ctx) => f.getTrusteeNotesRepository(ctx),
      MockMongoRepository,
    ],
    ['getOrdersRepository', (f, ctx) => f.getOrdersRepository(ctx), MockMongoRepository],
    [
      'getConsolidationOrdersRepository',
      (f, ctx) => f.getConsolidationOrdersRepository(ctx),
      MockMongoRepository,
    ],
    ['getCasesRepository', (f, ctx) => f.getCasesRepository(ctx), MockMongoRepository],
    [
      'getArchivedCasesRepository',
      (f, ctx) => f.getArchivedCasesRepository(ctx),
      MockMongoRepository,
    ],
    [
      'getUserSessionCacheRepository',
      (f, ctx) => f.getUserSessionCacheRepository(ctx),
      MockMongoRepository,
    ],
    [
      'getRuntimeStateRepository',
      (f, ctx) => f.getRuntimeStateRepository(ctx),
      MockMongoRepository,
    ],
    ['getOrderSyncStateRepo', (f, ctx) => f.getOrderSyncStateRepo(ctx), MockMongoRepository],
    [
      'getOfficeStaffSyncStateRepo',
      (f, ctx) => f.getOfficeStaffSyncStateRepo(ctx),
      MockMongoRepository,
    ],
    ['getCasesSyncStateRepo', (f, ctx) => f.getCasesSyncStateRepo(ctx), MockMongoRepository],
    [
      'getPhoneticBackfillStateRepo',
      (f, ctx) => f.getPhoneticBackfillStateRepo(ctx),
      MockMongoRepository,
    ],
    [
      'getCaseAppointmentDateBackfillStateRepo',
      (f, ctx) => f.getCaseAppointmentDateBackfillStateRepo(ctx),
      MockMongoRepository,
    ],
    [
      'getTrusteeAppointmentsSyncStateRepo',
      (f, ctx) => f.getTrusteeAppointmentsSyncStateRepo(ctx),
      MockMongoRepository,
    ],
    [
      'getTrusteeNotesMetricsSyncStateRepo',
      (f, ctx) => f.getTrusteeNotesMetricsSyncStateRepo(ctx),
      MockMongoRepository,
    ],
    ['getUsersRepository', (f, ctx) => f.getUsersRepository(ctx), MockMongoRepository],
    [
      'getOfficeAssigneesRepository',
      (f, ctx) => f.getOfficeAssigneesRepository(ctx),
      MockMongoRepository,
    ],
    ['getUserGroupsRepository', (f, ctx) => f.getUserGroupsRepository(ctx), MockMongoRepository],
    ['getTrusteesRepository', (f, ctx) => f.getTrusteesRepository(ctx), MockMongoRepository],
    [
      'getTrusteeAppointmentsRepository',
      (f, ctx) => f.getTrusteeAppointmentsRepository(ctx),
      MockMongoRepository,
    ],
    [
      'getTrusteeAssistantsRepository',
      (f, ctx) => f.getTrusteeAssistantsRepository(ctx),
      MockMongoRepository,
    ],
    ['getListsGateway', (f, ctx) => f.getListsGateway(ctx), MockMongoRepository],
    [
      'getTrusteeUpcomingKeyDatesRepository',
      (f, ctx) => f.getTrusteeUpcomingKeyDatesRepository(ctx),
      MockMongoRepository,
    ],
    [
      'getTrusteeMatchVerificationRepository',
      (f, ctx) => f.getTrusteeMatchVerificationRepository(ctx),
      MockMongoRepository,
    ],
    [
      'getTrusteeProfessionalIdsRepository',
      (f, ctx) => f.getTrusteeProfessionalIdsRepository(ctx),
      MockMongoRepository,
    ],
    [
      'getObjectStorageGateway',
      (f, ctx) => f.getObjectStorageGateway(ctx),
      AzureBlobObjectStorageGateway,
    ],
    ['getAcmsGateway', (f, ctx) => f.getAcmsGateway(ctx), AcmsGatewayImpl],
    ['getAtsGateway', (f, ctx) => f.getAtsGateway(ctx), MockAtsGateway],
    [
      'getApiToDataflowsGateway',
      (f, ctx) => f.getApiToDataflowsGateway(ctx),
      ApiToDataflowsGatewayImpl,
    ],
  ] as const)('%s returns an instance of the expected type', (_label, getter, ExpectedType) => {
    expect(getter(factory, context)).toBeInstanceOf(ExpectedType);
  });

  test('getStorageGateway returns a defined instance', () => {
    expect(factory.getStorageGateway(context)).toBeDefined();
  });

  test('getOfficesRepository returns MockMongoRepository for mock provider and OfficesMongoRepository for okta', () => {
    const mockCtx = { ...context };
    mockCtx.config.authConfig.provider = 'mock';
    expect(factory.getOfficesRepository(mockCtx)).toBeInstanceOf(MockMongoRepository);

    const oktaCtx = { ...context };
    oktaCtx.config.authConfig.provider = 'okta';
    expect(factory.getOfficesRepository(oktaCtx)).toBeInstanceOf(OfficesMongoRepository);
  });

  test('getAuthorizationGateway returns OktaGateway, MockOpenIdConnectGateway, or null by provider', () => {
    const oktaCtx = { ...context };
    oktaCtx.config.authConfig.provider = 'okta';
    expect(factory.getAuthorizationGateway(oktaCtx)).toEqual(OktaGateway);

    const mockCtx = { ...context };
    mockCtx.config.authConfig.provider = 'mock';
    expect(factory.getAuthorizationGateway(mockCtx)).toEqual(MockOpenIdConnectGateway);

    const unknownCtx = { ...context };
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
      const ctx = makeOktaUserGroupContext(context);
      vi.spyOn(OktaHumbleClass.prototype, 'init').mockImplementation(vi.fn());
      expect(await f.getUserGroupGateway(ctx)).toBeInstanceOf(OktaUserGroupGatewayClass);
    });

    test('returns MockUserGroupGateway for mock provider', async () => {
      const ctx = { ...context };
      ctx.config.authConfig.provider = 'mock';
      ctx.config.userGroupGatewayConfig.provider = 'mock';
      expect(await f.getUserGroupGateway(ctx)).toBeInstanceOf(MockUserGroupGatewayClass);
    });

    test('throws when init fails', async () => {
      const ctx = makeOktaUserGroupContext(context);
      vi.spyOn(OktaUserGroupGatewayClass.prototype, 'init').mockRejectedValue(
        new Error('init failed'),
      );
      await expect(f.getUserGroupGateway(ctx)).rejects.toThrow();
    });

    test('throws for unsupported provider', async () => {
      const ctx = { ...context };
      ctx.config.authConfig.provider = 'unsupported';
      await expect(f.getUserGroupGateway(ctx)).rejects.toThrow();
    });
  });

  test('getUserSessionUseCase returns UserSessionUseCase or MockUserSessionUseCase by provider', () => {
    const oktaCtx = { ...context };
    oktaCtx.config.authConfig.provider = 'okta';
    expect(factory.getUserSessionUseCase(oktaCtx)).toBeInstanceOf(UserSessionUseCase);

    const mockCtx = { ...context };
    mockCtx.config.authConfig.provider = 'mock';
    expect(factory.getUserSessionUseCase(mockCtx)).toBeInstanceOf(MockUserSessionUseCase);
  });
});
