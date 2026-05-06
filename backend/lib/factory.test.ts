import { vi, beforeAll, beforeEach, describe, test, expect } from 'vitest';
import factory from './factory';
import { ApplicationContext } from './adapters/types/basic';
import OktaGateway from './adapters/gateways/okta/okta-gateway';
import MockOpenIdConnectGateway from './testing/mock-gateways/mock-oauth2-gateway';
import { MockUserSessionUseCase } from './testing/mock-gateways/mock-user-session-use-case';
import { UserSessionUseCase } from './use-cases/user-session/user-session';
import { createMockApplicationContext } from './testing/testing-utilities';

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
    ['getCasesGateway', (f, ctx) => f.getCasesGateway(ctx)],
    ['getCaseDocketUseCase', (f, ctx) => f.getCaseDocketUseCase(ctx)],
    ['getOrdersGateway', (f, ctx) => f.getOrdersGateway(ctx)],
    ['getOfficesGateway', (f, ctx) => f.getOfficesGateway(ctx)],
    ['getAssignmentRepository', (f, ctx) => f.getAssignmentRepository(ctx)],
    ['getCaseNotesRepository', (f, ctx) => f.getCaseNotesRepository(ctx)],
    ['getTrusteeNotesRepository', (f, ctx) => f.getTrusteeNotesRepository(ctx)],
    ['getOrdersRepository', (f, ctx) => f.getOrdersRepository(ctx)],
    ['getConsolidationOrdersRepository', (f, ctx) => f.getConsolidationOrdersRepository(ctx)],
    ['getCasesRepository', (f, ctx) => f.getCasesRepository(ctx)],
    ['getArchivedCasesRepository', (f, ctx) => f.getArchivedCasesRepository(ctx)],
    ['getUserSessionCacheRepository', (f, ctx) => f.getUserSessionCacheRepository(ctx)],
    ['getRuntimeStateRepository', (f, ctx) => f.getRuntimeStateRepository(ctx)],
    ['getOrderSyncStateRepo', (f, ctx) => f.getOrderSyncStateRepo(ctx)],
    ['getOfficeStaffSyncStateRepo', (f, ctx) => f.getOfficeStaffSyncStateRepo(ctx)],
    ['getCasesSyncStateRepo', (f, ctx) => f.getCasesSyncStateRepo(ctx)],
    ['getPhoneticBackfillStateRepo', (f, ctx) => f.getPhoneticBackfillStateRepo(ctx)],
    [
      'getCaseAppointmentDateBackfillStateRepo',
      (f, ctx) => f.getCaseAppointmentDateBackfillStateRepo(ctx),
    ],
    ['getTrusteeAppointmentsSyncStateRepo', (f, ctx) => f.getTrusteeAppointmentsSyncStateRepo(ctx)],
    ['getTrusteeNotesMetricsSyncStateRepo', (f, ctx) => f.getTrusteeNotesMetricsSyncStateRepo(ctx)],
    ['getUsersRepository', (f, ctx) => f.getUsersRepository(ctx)],
    ['getOfficesRepository', (f, ctx) => f.getOfficesRepository(ctx)],
    ['getOfficeAssigneesRepository', (f, ctx) => f.getOfficeAssigneesRepository(ctx)],
    ['getUserGroupsRepository', (f, ctx) => f.getUserGroupsRepository(ctx)],
    ['getTrusteesRepository', (f, ctx) => f.getTrusteesRepository(ctx)],
    ['getTrusteeAppointmentsRepository', (f, ctx) => f.getTrusteeAppointmentsRepository(ctx)],
    ['getTrusteeAssistantsRepository', (f, ctx) => f.getTrusteeAssistantsRepository(ctx)],
    ['getListsGateway', (f, ctx) => f.getListsGateway(ctx)],
    [
      'getTrusteeUpcomingKeyDatesRepository',
      (f, ctx) => f.getTrusteeUpcomingKeyDatesRepository(ctx),
    ],
    [
      'getTrusteeMatchVerificationRepository',
      (f, ctx) => f.getTrusteeMatchVerificationRepository(ctx),
    ],
    ['getTrusteeProfessionalIdsRepository', (f, ctx) => f.getTrusteeProfessionalIdsRepository(ctx)],
    ['getStorageGateway', (f, ctx) => f.getStorageGateway(ctx)],
    ['getObjectStorageGateway', (f, ctx) => f.getObjectStorageGateway(ctx)],
    ['getAcmsGateway', (f, ctx) => f.getAcmsGateway(ctx)],
    ['getAtsGateway', (f, ctx) => f.getAtsGateway(ctx)],
    ['getApiToDataflowsGateway', (f, ctx) => f.getApiToDataflowsGateway(ctx)],
  ] as const)('%s returns a defined instance', (_label, getter) => {
    expect(getter(factory, dbContext)).toBeDefined();
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
