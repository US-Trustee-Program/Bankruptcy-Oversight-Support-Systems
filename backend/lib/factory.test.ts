import { vi, beforeEach, afterEach, describe, test, expect } from 'vitest';
import { ApplicationContext } from './adapters/types/basic';
import { createMockApplicationContext } from './testing/testing-utilities';

// Static imports are used only for type declarations.
// Values are re-imported dynamically in each beforeEach after vi.resetModules()
// because factory.ts holds module-level singletons that must be cleared between tests.
import type OktaGatewayType from './adapters/gateways/okta/okta-gateway';
import type MockOpenIdConnectGatewayType from './testing/mock-gateways/mock-oauth2-gateway';
import type { UserSessionUseCase as UserSessionUseCaseType } from './use-cases/user-session/user-session';
import type { MockUserSessionUseCase as MockUserSessionUseCaseType } from './testing/mock-gateways/mock-user-session-use-case';
import type { CaseDocketUseCase as CaseDocketUseCaseType } from './use-cases/case-docket/case-docket';
import type { CasesLocalGateway as CasesLocalGatewayType } from './adapters/gateways/cases.local.gateway';
import type { MockOrdersGateway as MockOrdersGatewayType } from './testing/mock-gateways/mock.orders.gateway';
import type { MockOfficesGateway as MockOfficesGatewayType } from './testing/mock-gateways/mock.offices.gateway';
import type { MockMongoRepository as MockMongoRepositoryType } from './testing/mock-gateways/mock-mongo.repository';
import type { MockAtsGateway as MockAtsGatewayType } from './adapters/gateways/ats/ats.mock.gateway';
import type CasesDxtrGatewayType from './adapters/gateways/dxtr/cases.dxtr.gateway';
import type DxtrOrdersGatewayType from './adapters/gateways/dxtr/orders.dxtr.gateway';
import type OfficesDxtrGatewayType from './adapters/gateways/dxtr/offices.dxtr.gateway';
import type { AtsGatewayImpl as AtsGatewayImplType } from './adapters/gateways/ats/ats.gateway';
import type { AzureBlobObjectStorageGateway as AzureBlobObjectStorageGatewayType } from './adapters/gateways/storage/azure-blob-object-storage.gateway';
import type { AcmsGatewayImpl as AcmsGatewayImplType } from './adapters/gateways/acms/acms.gateway';
import type { ApiToDataflowsGatewayImpl as ApiToDataflowsGatewayImplType } from './adapters/gateways/api-to-dataflows/api-to-dataflows.gateway';
import type { OfficesMongoRepository as OfficesMongoRepositoryType } from './adapters/gateways/mongo/offices.mongo.repository';
import type { CaseNotesMongoRepository as CaseNotesMongoRepositoryType } from './adapters/gateways/mongo/case-notes.mongo.repository';
import type { TrusteeNotesMongoRepository as TrusteeNotesMongoRepositoryType } from './adapters/gateways/mongo/trustee-notes.mongo.repository';
import type { OrdersMongoRepository as OrdersMongoRepositoryType } from './adapters/gateways/mongo/orders.mongo.repository';
import type ConsolidationOrdersMongoRepositoryType from './adapters/gateways/mongo/consolidations.mongo.repository';
import type { ArchivedCasesMongoRepository as ArchivedCasesMongoRepositoryType } from './adapters/gateways/mongo/archived-cases.mongo.repository';
import type { UserSessionCacheMongoRepository as UserSessionCacheMongoRepositoryType } from './adapters/gateways/mongo/user-session-cache.mongo.repository';
import type { RuntimeStateMongoRepository as RuntimeStateMongoRepositoryType } from './adapters/gateways/mongo/runtime-state.mongo.repository';
import type { UsersMongoRepository as UsersMongoRepositoryType } from './adapters/gateways/mongo/user.repository';
import type { OfficeAssigneeMongoRepository as OfficeAssigneeMongoRepositoryType } from './adapters/gateways/mongo/office-assignee.mongo.repository';
import type { UserGroupsMongoRepository as UserGroupsMongoRepositoryType } from './adapters/gateways/mongo/user-groups.mongo.repository';
import type { TrusteesMongoRepository as TrusteesMongoRepositoryType } from './adapters/gateways/mongo/trustees.mongo.repository';
import type { TrusteeAppointmentsMongoRepository as TrusteeAppointmentsMongoRepositoryType } from './adapters/gateways/mongo/trustee-appointments.mongo.repository';
import type { TrusteeStaffMongoRepository as TrusteeStaffMongoRepositoryType } from './adapters/gateways/mongo/trustee-staff.mongo.repository';
import type { ListsMongoRepository as ListsMongoRepositoryType } from './adapters/gateways/mongo/lists.mongo.repository';
import type { TrusteeUpcomingKeyDatesMongoRepository as TrusteeUpcomingKeyDatesMongoRepositoryType } from './adapters/gateways/mongo/trustee-upcoming-key-dates.mongo.repository';
import type { TrusteeMatchVerificationMongoRepository as TrusteeMatchVerificationMongoRepositoryType } from './adapters/gateways/mongo/trustee-match-verification.mongo.repository';
import type { TrusteeProfessionalIdsMongoRepository as TrusteeProfessionalIdsMongoRepositoryType } from './adapters/gateways/mongo/trustee-professional-ids.mongo.repository';
import type { BanksMongoRepository as BanksMongoRepositoryType } from './adapters/gateways/mongo/banks.mongo.repository';
import type { BankruptcySoftwareMongoRepository as BankruptcySoftwareMongoRepositoryType } from './adapters/gateways/mongo/bankruptcy-software.mongo.repository';
import type { TrusteeCaseAppointmentsMongoRepository as TrusteeCaseAppointmentsMongoRepositoryType } from './adapters/gateways/mongo/trustee-case-appointments.mongo.repository';
import type { NotificationRoutingMongoRepository as NotificationRoutingMongoRepositoryType } from './adapters/gateways/mongo/notification-routing.mongo.repository';
import type { CaseAssignmentMongoRepository as CaseAssignmentMongoRepositoryType } from './adapters/gateways/mongo/case-assignment.mongo.repository';
import type { CasesMongoRepository as CasesMongoRepositoryType } from './adapters/gateways/mongo/cases.mongo.repository';
import type { AcsNotificationGateway as AcsNotificationGatewayType } from './adapters/gateways/notifications/acs-notification.gateway';

type Factory = typeof import('./factory').default;
type Constructor<T> = new (...args: unknown[]) => T;
type Singleton<T> = { prototype: T };

function cloneContext(
  base: ApplicationContext,
  authOverrides?: Partial<typeof base.config.authConfig>,
  userGroupOverrides?: Partial<typeof base.config.userGroupGatewayConfig>,
): ApplicationContext {
  const config = Object.assign(Object.create(Object.getPrototypeOf(base.config)), base.config);
  if (authOverrides) config.authConfig = { ...base.config.authConfig, ...authOverrides };
  if (userGroupOverrides)
    config.userGroupGatewayConfig = {
      ...base.config.userGroupGatewayConfig,
      ...userGroupOverrides,
    };
  return { ...base, config };
}

describe('Factory real implementations (DATABASE_MOCK=false)', () => {
  let context: ApplicationContext;
  let factory: Factory;

  let CasesDxtrGateway: Constructor<CasesDxtrGatewayType>;
  let DxtrOrdersGateway: Constructor<DxtrOrdersGatewayType>;
  let OfficesDxtrGateway: Constructor<OfficesDxtrGatewayType>;
  let CaseDocketUseCase: Constructor<CaseDocketUseCaseType>;
  let CaseNotesMongoRepository: Constructor<CaseNotesMongoRepositoryType>;
  let TrusteeNotesMongoRepository: Constructor<TrusteeNotesMongoRepositoryType>;
  let OrdersMongoRepository: Singleton<OrdersMongoRepositoryType>;
  let ConsolidationOrdersMongoRepository: Constructor<ConsolidationOrdersMongoRepositoryType>;
  let ArchivedCasesMongoRepository: Constructor<ArchivedCasesMongoRepositoryType>;
  let UserSessionCacheMongoRepository: Constructor<UserSessionCacheMongoRepositoryType>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let RuntimeStateMongoRepository: Singleton<RuntimeStateMongoRepositoryType<any>>;
  let UsersMongoRepository: Constructor<UsersMongoRepositoryType>;
  let OfficeAssigneeMongoRepository: Singleton<OfficeAssigneeMongoRepositoryType>;
  let UserGroupsMongoRepository: Constructor<UserGroupsMongoRepositoryType>;
  let TrusteesMongoRepository: Constructor<TrusteesMongoRepositoryType>;
  let TrusteeAppointmentsMongoRepository: Constructor<TrusteeAppointmentsMongoRepositoryType>;
  let TrusteeStaffMongoRepository: Constructor<TrusteeStaffMongoRepositoryType>;
  let ListsMongoRepository: Constructor<ListsMongoRepositoryType>;
  let TrusteeUpcomingKeyDatesMongoRepository: Constructor<TrusteeUpcomingKeyDatesMongoRepositoryType>;
  let TrusteeMatchVerificationMongoRepository: Constructor<TrusteeMatchVerificationMongoRepositoryType>;
  let TrusteeProfessionalIdsMongoRepository: Constructor<TrusteeProfessionalIdsMongoRepositoryType>;
  let AzureBlobObjectStorageGateway: Constructor<AzureBlobObjectStorageGatewayType>;
  let AcmsGatewayImpl: Constructor<AcmsGatewayImplType>;
  let AtsGatewayImpl: Constructor<AtsGatewayImplType>;
  let ApiToDataflowsGatewayImpl: Constructor<ApiToDataflowsGatewayImplType>;
  let OfficesMongoRepository: Constructor<OfficesMongoRepositoryType>;
  let OktaGateway: typeof OktaGatewayType;
  let UserSessionUseCase: Constructor<UserSessionUseCaseType>;
  let BanksMongoRepository: Constructor<BanksMongoRepositoryType>;
  let BankruptcySoftwareMongoRepository: Constructor<BankruptcySoftwareMongoRepositoryType>;
  let TrusteeCaseAppointmentsMongoRepository: Constructor<TrusteeCaseAppointmentsMongoRepositoryType>;
  let NotificationRoutingMongoRepository: Constructor<NotificationRoutingMongoRepositoryType>;
  let CaseAssignmentMongoRepository: Constructor<CaseAssignmentMongoRepositoryType>;
  let CasesMongoRepository: Singleton<CasesMongoRepositoryType>;
  let AcsNotificationGateway: Constructor<AcsNotificationGatewayType>;

  beforeEach(async () => {
    vi.resetModules();
    factory = (await import('./factory')).default;
    context = await createMockApplicationContext({
      env: {
        CAMS_LOGIN_PROVIDER: 'okta',
        DATABASE_MOCK: 'false',
        COSMOS_ENDPOINT: 'https://cosmos-ustp-cams-dev.documents.azure.us:443/',
        CAMS_USER_GROUP_GATEWAY_CONFIG:
          'url=https://fake.url|clientId=mock|keyId=mock|privateKey={"foo": "bar"}}',
      },
    });

    CasesDxtrGateway = (await import('./adapters/gateways/dxtr/cases.dxtr.gateway')).default;
    DxtrOrdersGateway = (await import('./adapters/gateways/dxtr/orders.dxtr.gateway')).default;
    OfficesDxtrGateway = (await import('./adapters/gateways/dxtr/offices.dxtr.gateway')).default;
    ({ CaseDocketUseCase } = await import('./use-cases/case-docket/case-docket'));
    ({ CaseNotesMongoRepository } =
      await import('./adapters/gateways/mongo/case-notes.mongo.repository'));
    ({ TrusteeNotesMongoRepository } =
      await import('./adapters/gateways/mongo/trustee-notes.mongo.repository'));
    ({ OrdersMongoRepository } = await import('./adapters/gateways/mongo/orders.mongo.repository'));
    ConsolidationOrdersMongoRepository = (
      await import('./adapters/gateways/mongo/consolidations.mongo.repository')
    ).default;
    ({ ArchivedCasesMongoRepository } =
      await import('./adapters/gateways/mongo/archived-cases.mongo.repository'));
    ({ UserSessionCacheMongoRepository } =
      await import('./adapters/gateways/mongo/user-session-cache.mongo.repository'));
    ({ RuntimeStateMongoRepository } =
      await import('./adapters/gateways/mongo/runtime-state.mongo.repository'));
    ({ UsersMongoRepository } = await import('./adapters/gateways/mongo/user.repository'));
    ({ OfficeAssigneeMongoRepository } =
      await import('./adapters/gateways/mongo/office-assignee.mongo.repository'));
    ({ UserGroupsMongoRepository } =
      await import('./adapters/gateways/mongo/user-groups.mongo.repository'));
    ({ TrusteesMongoRepository } =
      await import('./adapters/gateways/mongo/trustees.mongo.repository'));
    ({ TrusteeAppointmentsMongoRepository } =
      await import('./adapters/gateways/mongo/trustee-appointments.mongo.repository'));
    ({ TrusteeStaffMongoRepository } =
      await import('./adapters/gateways/mongo/trustee-staff.mongo.repository'));
    ({ ListsMongoRepository } = await import('./adapters/gateways/mongo/lists.mongo.repository'));
    ({ TrusteeUpcomingKeyDatesMongoRepository } =
      await import('./adapters/gateways/mongo/trustee-upcoming-key-dates.mongo.repository'));
    ({ TrusteeMatchVerificationMongoRepository } =
      await import('./adapters/gateways/mongo/trustee-match-verification.mongo.repository'));
    ({ TrusteeProfessionalIdsMongoRepository } =
      await import('./adapters/gateways/mongo/trustee-professional-ids.mongo.repository'));
    ({ AzureBlobObjectStorageGateway } =
      await import('./adapters/gateways/storage/azure-blob-object-storage.gateway'));
    ({ AcmsGatewayImpl } = await import('./adapters/gateways/acms/acms.gateway'));
    ({ AtsGatewayImpl } = await import('./adapters/gateways/ats/ats.gateway'));
    ({ ApiToDataflowsGatewayImpl } =
      await import('./adapters/gateways/api-to-dataflows/api-to-dataflows.gateway'));
    ({ OfficesMongoRepository } =
      await import('./adapters/gateways/mongo/offices.mongo.repository'));
    OktaGateway = (await import('./adapters/gateways/okta/okta-gateway')).default;
    ({ UserSessionUseCase } = await import('./use-cases/user-session/user-session'));
    ({ BanksMongoRepository } = await import('./adapters/gateways/mongo/banks.mongo.repository'));
    ({ BankruptcySoftwareMongoRepository } =
      await import('./adapters/gateways/mongo/bankruptcy-software.mongo.repository'));
    ({ TrusteeCaseAppointmentsMongoRepository } =
      await import('./adapters/gateways/mongo/trustee-case-appointments.mongo.repository'));
    ({ NotificationRoutingMongoRepository } =
      await import('./adapters/gateways/mongo/notification-routing.mongo.repository'));
    ({ CaseAssignmentMongoRepository } =
      await import('./adapters/gateways/mongo/case-assignment.mongo.repository'));
    ({ CasesMongoRepository } = await import('./adapters/gateways/mongo/cases.mongo.repository'));
    ({ AcsNotificationGateway } =
      await import('./adapters/gateways/notifications/acs-notification.gateway'));
  });

  test.each([
    ['getCasesGateway', () => CasesDxtrGateway],
    ['getCaseDocketUseCase', () => CaseDocketUseCase],
    ['getOrdersGateway', () => DxtrOrdersGateway],
    ['getOfficesGateway', () => OfficesDxtrGateway],
    ['getCaseNotesRepository', () => CaseNotesMongoRepository],
    ['getTrusteeNotesRepository', () => TrusteeNotesMongoRepository],
    ['getOrdersRepository', () => OrdersMongoRepository],
    ['getConsolidationOrdersRepository', () => ConsolidationOrdersMongoRepository],
    ['getArchivedCasesRepository', () => ArchivedCasesMongoRepository],
    ['getUserSessionCacheRepository', () => UserSessionCacheMongoRepository],
    ['getRuntimeStateRepository', () => RuntimeStateMongoRepository],
    ['getOrderSyncStateRepo', () => RuntimeStateMongoRepository],
    ['getOfficeStaffSyncStateRepo', () => RuntimeStateMongoRepository],
    ['getCasesSyncStateRepo', () => RuntimeStateMongoRepository],
    ['getPhoneticBackfillStateRepo', () => RuntimeStateMongoRepository],
    ['getCaseAppointmentDateBackfillStateRepo', () => RuntimeStateMongoRepository],
    ['getTrusteeAppointmentsSyncStateRepo', () => RuntimeStateMongoRepository],
    ['getTrusteePetitionSyncStateRepo', () => RuntimeStateMongoRepository],
    ['getTrusteeNotesMetricsSyncStateRepo', () => RuntimeStateMongoRepository],
    ['getUsersRepository', () => UsersMongoRepository],
    ['getOfficeAssigneesRepository', () => OfficeAssigneeMongoRepository],
    ['getUserGroupsRepository', () => UserGroupsMongoRepository],
    ['getTrusteesRepository', () => TrusteesMongoRepository],
    ['getTrusteeAppointmentsRepository', () => TrusteeAppointmentsMongoRepository],
    ['getTrusteeStaffRepository', () => TrusteeStaffMongoRepository],
    ['getListsGateway', () => ListsMongoRepository],
    ['getTrusteeUpcomingKeyDatesRepository', () => TrusteeUpcomingKeyDatesMongoRepository],
    ['getTrusteeMatchVerificationRepository', () => TrusteeMatchVerificationMongoRepository],
    ['getTrusteeProfessionalIdsRepository', () => TrusteeProfessionalIdsMongoRepository],
    ['getObjectStorageGateway', () => AzureBlobObjectStorageGateway],
    ['getAcmsGateway', () => AcmsGatewayImpl],
    ['getAtsGateway', () => AtsGatewayImpl],
    ['getApiToDataflowsGateway', () => ApiToDataflowsGatewayImpl],
    ['getBanksRepository', () => BanksMongoRepository],
    ['getBankruptcySoftwareRepository', () => BankruptcySoftwareMongoRepository],
    ['getTrusteeAppointmentsDownstreamBackfillStateRepo', () => RuntimeStateMongoRepository],
    ['getTrusteeCaseAppointmentsRepository', () => TrusteeCaseAppointmentsMongoRepository],
    ['getNotificationRoutingRepository', () => NotificationRoutingMongoRepository],
    ['getAssignmentRepository', () => CaseAssignmentMongoRepository],
    ['getCasesRepository', () => CasesMongoRepository],
  ] as const)('%s', (method, getExpectedType) => {
    expect(factory[method](context)).toBeInstanceOf(getExpectedType());
  });

  test('getStorageGateway returns a defined instance', () => {
    expect(factory.getStorageGateway(context)).toBeDefined();
  });

  describe('getNotificationGateway', () => {
    const originalConnectionString = process.env.ACS_EMAIL_CONNECTION_STRING;
    const originalSenderAddress = process.env.ACS_EMAIL_SENDER_ADDRESS;

    afterEach(() => {
      process.env.ACS_EMAIL_CONNECTION_STRING = originalConnectionString;
      process.env.ACS_EMAIL_SENDER_ADDRESS = originalSenderAddress;
    });

    test('returns an AcsNotificationGateway when ACS env vars are configured', () => {
      process.env.ACS_EMAIL_CONNECTION_STRING = 'endpoint=https://fake;accesskey=fake';
      process.env.ACS_EMAIL_SENDER_ADDRESS = 'noreply@example.com';

      expect(factory.getNotificationGateway(context)).toBeInstanceOf(AcsNotificationGateway);
    });

    test('throws when ACS env vars are missing', () => {
      delete process.env.ACS_EMAIL_CONNECTION_STRING;
      delete process.env.ACS_EMAIL_SENDER_ADDRESS;

      expect(() => factory.getNotificationGateway(context)).toThrow(
        'ACS_EMAIL_CONNECTION_STRING and ACS_EMAIL_SENDER_ADDRESS must be configured.',
      );
    });

    test('returns the same instance on repeated calls (singleton) until reset', () => {
      process.env.ACS_EMAIL_CONNECTION_STRING = 'endpoint=https://fake;accesskey=fake';
      process.env.ACS_EMAIL_SENDER_ADDRESS = 'noreply@example.com';

      const first = factory.getNotificationGateway(context);
      const second = factory.getNotificationGateway(context);
      expect(first).toBe(second);

      factory.resetNotificationGateway();
      const third = factory.getNotificationGateway(context);
      expect(third).not.toBe(first);
    });
  });

  test('getOfficesRepository returns OfficesMongoRepository for okta provider', () => {
    expect(
      factory.getOfficesRepository(cloneContext(context, { provider: 'okta' })),
    ).toBeInstanceOf(OfficesMongoRepository);
  });

  test('getAuthorizationGateway returns OktaGateway for okta provider', () => {
    expect(factory.getAuthorizationGateway(cloneContext(context, { provider: 'okta' }))).toEqual(
      OktaGateway,
    );
  });

  test('getUserSessionUseCase returns UserSessionUseCase for okta provider', () => {
    expect(
      factory.getUserSessionUseCase(cloneContext(context, { provider: 'okta' })),
    ).toBeInstanceOf(UserSessionUseCase);
  });
});

describe('Factory mock implementations (DATABASE_MOCK=true)', () => {
  let context: ApplicationContext;
  let factory: Factory;

  let CasesLocalGateway: Constructor<CasesLocalGatewayType>;
  let MockOrdersGateway: Constructor<MockOrdersGatewayType>;
  let MockOfficesGateway: Constructor<MockOfficesGatewayType>;
  let CaseDocketUseCase: Constructor<CaseDocketUseCaseType>;
  let MockMongoRepository: Constructor<MockMongoRepositoryType>;
  let MockAtsGateway: Singleton<MockAtsGatewayType>;
  let AzureBlobObjectStorageGateway: Constructor<AzureBlobObjectStorageGatewayType>;
  let AcmsGatewayImpl: Constructor<AcmsGatewayImplType>;
  let ApiToDataflowsGatewayImpl: Constructor<ApiToDataflowsGatewayImplType>;
  let MockOpenIdConnectGateway: typeof MockOpenIdConnectGatewayType;
  let MockUserSessionUseCase: Constructor<MockUserSessionUseCaseType>;

  beforeEach(async () => {
    vi.resetModules();
    factory = (await import('./factory')).default;
    context = await createMockApplicationContext();

    ({ CasesLocalGateway } = await import('./adapters/gateways/cases.local.gateway'));
    ({ MockOrdersGateway } = await import('./testing/mock-gateways/mock.orders.gateway'));
    ({ MockOfficesGateway } = await import('./testing/mock-gateways/mock.offices.gateway'));
    ({ CaseDocketUseCase } = await import('./use-cases/case-docket/case-docket'));
    ({ MockMongoRepository } = await import('./testing/mock-gateways/mock-mongo.repository'));
    ({ MockAtsGateway } = await import('./adapters/gateways/ats/ats.mock.gateway'));
    ({ AzureBlobObjectStorageGateway } =
      await import('./adapters/gateways/storage/azure-blob-object-storage.gateway'));
    ({ AcmsGatewayImpl } = await import('./adapters/gateways/acms/acms.gateway'));
    ({ ApiToDataflowsGatewayImpl } =
      await import('./adapters/gateways/api-to-dataflows/api-to-dataflows.gateway'));
    MockOpenIdConnectGateway = (await import('./testing/mock-gateways/mock-oauth2-gateway'))
      .default;
    ({ MockUserSessionUseCase } =
      await import('./testing/mock-gateways/mock-user-session-use-case'));
  });

  test.each([
    ['getCasesGateway', () => CasesLocalGateway],
    ['getCaseDocketUseCase', () => CaseDocketUseCase],
    ['getOrdersGateway', () => MockOrdersGateway],
    ['getOfficesGateway', () => MockOfficesGateway],
    ['getAssignmentRepository', () => MockMongoRepository],
    ['getCaseNotesRepository', () => MockMongoRepository],
    ['getTrusteeNotesRepository', () => MockMongoRepository],
    ['getOrdersRepository', () => MockMongoRepository],
    ['getConsolidationOrdersRepository', () => MockMongoRepository],
    ['getCasesRepository', () => MockMongoRepository],
    ['getArchivedCasesRepository', () => MockMongoRepository],
    ['getUserSessionCacheRepository', () => MockMongoRepository],
    ['getRuntimeStateRepository', () => MockMongoRepository],
    ['getOrderSyncStateRepo', () => MockMongoRepository],
    ['getOfficeStaffSyncStateRepo', () => MockMongoRepository],
    ['getCasesSyncStateRepo', () => MockMongoRepository],
    ['getPhoneticBackfillStateRepo', () => MockMongoRepository],
    ['getCaseAppointmentDateBackfillStateRepo', () => MockMongoRepository],
    ['getTrusteeAppointmentsSyncStateRepo', () => MockMongoRepository],
    ['getTrusteePetitionSyncStateRepo', () => MockMongoRepository],
    ['getTrusteeNotesMetricsSyncStateRepo', () => MockMongoRepository],
    ['getUsersRepository', () => MockMongoRepository],
    ['getOfficeAssigneesRepository', () => MockMongoRepository],
    ['getUserGroupsRepository', () => MockMongoRepository],
    ['getTrusteesRepository', () => MockMongoRepository],
    ['getTrusteeAppointmentsRepository', () => MockMongoRepository],
    ['getTrusteeStaffRepository', () => MockMongoRepository],
    ['getListsGateway', () => MockMongoRepository],
    ['getTrusteeUpcomingKeyDatesRepository', () => MockMongoRepository],
    ['getTrusteeMatchVerificationRepository', () => MockMongoRepository],
    ['getTrusteeProfessionalIdsRepository', () => MockMongoRepository],
    ['getObjectStorageGateway', () => AzureBlobObjectStorageGateway],
    ['getAcmsGateway', () => AcmsGatewayImpl],
    ['getAtsGateway', () => MockAtsGateway],
    ['getApiToDataflowsGateway', () => ApiToDataflowsGatewayImpl],
    ['getBanksRepository', () => MockMongoRepository],
    ['getBankruptcySoftwareRepository', () => MockMongoRepository],
    ['getTrusteeAppointmentsDownstreamBackfillStateRepo', () => MockMongoRepository],
    ['getTrusteeCaseAppointmentsRepository', () => MockMongoRepository],
    ['getNotificationRoutingRepository', () => MockMongoRepository],
  ] as const)('%s', (method, getExpectedType) => {
    expect(factory[method](context)).toBeInstanceOf(getExpectedType());
  });

  test('getNotificationGateway returns MockNotificationGateway for mock provider', async () => {
    const { MockNotificationGateway } =
      await import('./testing/mock-gateways/mock-notification.gateway');
    expect(factory.getNotificationGateway(context)).toBeInstanceOf(MockNotificationGateway);
  });

  test('getStorageGateway returns a defined instance', () => {
    expect(factory.getStorageGateway(context)).toBeDefined();
  });

  test('getOfficesRepository returns MockMongoRepository for mock provider', () => {
    expect(
      factory.getOfficesRepository(cloneContext(context, { provider: 'mock' })),
    ).toBeInstanceOf(MockMongoRepository);
  });

  test('getAuthorizationGateway returns MockOpenIdConnectGateway for mock provider', () => {
    expect(factory.getAuthorizationGateway(cloneContext(context, { provider: 'mock' }))).toEqual(
      MockOpenIdConnectGateway,
    );
  });

  test('getAuthorizationGateway returns null for unknown provider', () => {
    expect(
      factory.getAuthorizationGateway(cloneContext(context, { provider: 'unknown' })),
    ).toBeNull();
  });

  test('getUserSessionUseCase returns MockUserSessionUseCase for mock provider', () => {
    expect(
      factory.getUserSessionUseCase(cloneContext(context, { provider: 'mock' })),
    ).toBeInstanceOf(MockUserSessionUseCase);
  });

  describe('getUserGroupGateway', () => {
    let f: Factory;
    let OktaHumble: typeof import('./humble-objects/okta-humble').default;
    let OktaUserGroupGateway: typeof import('./adapters/gateways/okta/okta-user-group-gateway').default;
    let MockUserGroupGateway: typeof import('./testing/mock-gateways/mock-user-group-gateway').default;

    function makeOktaUserGroupContext(base: ApplicationContext): ApplicationContext {
      return cloneContext(
        base,
        { provider: 'okta' },
        {
          provider: 'okta',
          clientId: 'mock',
          keyId: 'mock',
          url: 'https://fake.url',
          privateKey: '{}',
        },
      );
    }

    beforeEach(async () => {
      vi.resetModules();
      f = (await import('./factory')).default;
      OktaHumble = (await import('./humble-objects/okta-humble')).default;
      OktaUserGroupGateway = (await import('./adapters/gateways/okta/okta-user-group-gateway'))
        .default;
      MockUserGroupGateway = (await import('./testing/mock-gateways/mock-user-group-gateway'))
        .default;
    });

    test('returns OktaUserGroupGateway for okta provider', async () => {
      const ctx = makeOktaUserGroupContext(context);
      vi.spyOn(OktaHumble.prototype, 'init').mockImplementation(vi.fn());
      expect(await f.getUserGroupGateway(ctx)).toBeInstanceOf(OktaUserGroupGateway);
    });

    test('reuses the cached okta gateway instance on repeated calls without re-initializing', async () => {
      const ctx = makeOktaUserGroupContext(context);
      const initSpy = vi.spyOn(OktaHumble.prototype, 'init').mockImplementation(vi.fn());

      const first = await f.getUserGroupGateway(ctx);
      const second = await f.getUserGroupGateway(ctx);

      expect(second).toBe(first);
      expect(initSpy).toHaveBeenCalledTimes(1);
    });

    test('returns MockUserGroupGateway for mock provider', async () => {
      const ctx = cloneContext(context, { provider: 'mock' }, { provider: 'mock' });
      expect(await f.getUserGroupGateway(ctx)).toBeInstanceOf(MockUserGroupGateway);
    });

    test('throws when init fails', async () => {
      const ctx = makeOktaUserGroupContext(context);
      vi.spyOn(OktaUserGroupGateway.prototype, 'init').mockRejectedValue(new Error('init failed'));
      await expect(f.getUserGroupGateway(ctx)).rejects.toThrow();
    });

    test('throws for unsupported provider', async () => {
      await expect(
        f.getUserGroupGateway(cloneContext(context, { provider: 'unsupported' })),
      ).rejects.toThrow();
    });
  });
});

describe('Factory getObservability', () => {
  let factory: Factory;
  let AppInsightsObservability: Constructor<
    import('./adapters/services/observability').AppInsightsObservability
  >;
  let NoOpObservability: Constructor<import('./adapters/services/observability').NoOpObservability>;
  const originalDatabaseMock = process.env.DATABASE_MOCK;

  beforeEach(async () => {
    vi.resetModules();
    factory = (await import('./factory')).default;
    ({ AppInsightsObservability, NoOpObservability } =
      await import('./adapters/services/observability'));
  });

  afterEach(() => {
    process.env.DATABASE_MOCK = originalDatabaseMock;
  });

  test('returns an ObservabilityGateway with startTrace and completeTrace', () => {
    const observability = factory.getObservability();
    expect(typeof observability.startTrace).toBe('function');
    expect(typeof observability.completeTrace).toBe('function');
  });

  test('returns the same instance on repeated calls (process singleton)', () => {
    expect(factory.getObservability()).toBe(factory.getObservability());
  });

  test('accepts an optional logger without an application context', async () => {
    const { LoggerImpl } = await import('./adapters/services/logger.service');
    const logger = new LoggerImpl('invocation-id');
    expect(factory.getObservability(logger)).toBeDefined();
  });

  test('resolves the no-op implementation when DATABASE_MOCK is true', () => {
    process.env.DATABASE_MOCK = 'true';
    expect(factory.getObservability()).toBeInstanceOf(NoOpObservability);
  });

  test('resolves the real AppInsights implementation when DATABASE_MOCK is false', () => {
    process.env.DATABASE_MOCK = 'false';
    expect(factory.getObservability()).toBeInstanceOf(AppInsightsObservability);
  });
});
