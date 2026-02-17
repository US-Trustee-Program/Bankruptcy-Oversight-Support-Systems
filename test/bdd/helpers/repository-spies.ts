import { vi } from 'vitest';
import type { CamsSession } from '@common/cams/session';

/**
 * Repository Spy Helpers for BDD Tests
 *
 * These helpers spy on production repository/gateway implementations.
 * This allows full-stack testing while mocking only at the edges (database/external services).
 *
 * The main entry point is `spyOnAllGateways()` which is called by the fluent test setup API.
 * This ensures comprehensive spy coverage with clear error messages for unmocked methods.
 *
 * Usage:
 * ```typescript
 * // Via fluent API (recommended):
 * await TestSetup
 *   .forUser(session)
 *   .withCase(testCase)
 *   .renderAt('/case-detail/123');
 *
 * // Direct usage (advanced):
 * await spyOnAllGateways({
 *   CasesDxtrGateway: {
 *     getCaseDetail: vi.fn().mockResolvedValue(testCase)
 *   }
 * });
 * ```
 */

/**
 * Spy on the /me endpoint to return the session
 * This is critical because Session component calls Api2.getMe() before showing children
 *
 * IMPORTANT: The gateway used depends on CAMS_LOGIN_PROVIDER:
 * - 'okta' -> OktaGateway.getUser() (JWT verification) then OktaUserGroupGateway.getUserById()
 * - 'mock' -> UserSessionCacheMongoRepository.read()
 *
 * For okta provider, we spy on OktaGateway.getUser() to bypass JWT verification
 * (which requires HTTPS URLs that we can't use in tests)
 */
export async function spyOnMeEndpoint(session: CamsSession) {
  // For okta provider, spy on OktaGateway.getUser() to bypass JWT verification
  const OktaGatewayModule =
    await import('../../../backend/lib/adapters/gateways/okta/okta-gateway');

  // Mock getUser to return user with JWT that matches our test session
  // This bypasses the JWT verification that requires HTTPS
  vi.spyOn(OktaGatewayModule.default, 'getUser').mockResolvedValue({
    user: session.user,
    groups: [],
    jwt: {
      claims: {
        sub: session.user.id,
        iss: session.issuer,
        aud: 'api://default',
        exp: session.expires,
        groups: session.user.roles,
      },
    },
  });

  // Also spy on OktaUserGroupGateway.getUserById for user info retrieval
  const OktaUserGroupGatewayModule =
    await import('../../../backend/lib/adapters/gateways/okta/okta-user-group-gateway');
  const OktaUserGroupGateway = OktaUserGroupGatewayModule.default;

  vi.spyOn(OktaUserGroupGateway.prototype, 'getUserById').mockResolvedValue({
    ...session.user,
    groups: session.user.roles || [],
  });

  // Spy on office attorneys endpoint (called by postLoginTasks in Session.tsx)
  const { OfficesMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/offices.mongo.repository');
  vi.spyOn(OfficesMongoRepository.prototype, 'getOfficeAttorneys').mockResolvedValue([]);

  // Spy on user session cache to prevent MongoDB queries during search/consolidation
  const { UserSessionCacheMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/user-session-cache.mongo.repository');
  vi.spyOn(UserSessionCacheMongoRepository.prototype, 'read').mockResolvedValue({
    user: session.user,
    issuer: session.issuer,
    expires: session.expires,
    accessToken: session.accessToken,
    provider: session.provider,
  });
}

/**
 * Spy on all methods of a gateway/repository class and throw for unmocked calls
 * This helps identify which methods need to be mocked for a test
 */
export function spyOnAllGatewayMethods(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ClassName: any,
  gatewayName: string,
  explicitMocks: Record<string, unknown> = {},
) {
  if (!ClassName) {
    console.error(`[BDD TEST] Class ${gatewayName} is undefined - skipping spy setup`);
    return;
  }

  const prototype = ClassName.prototype;
  if (!prototype) {
    console.error(`[BDD TEST] ${gatewayName}.prototype is undefined - skipping spy setup`);
    return;
  }

  const methodNames = Object.getOwnPropertyNames(prototype).filter(
    (name) => name !== 'constructor' && typeof prototype[name] === 'function',
  );

  methodNames.forEach((methodName) => {
    if (explicitMocks[methodName]) {
      // Use the explicit mock provided
      vi.spyOn(prototype, methodName).mockImplementation(explicitMocks[methodName]);
    } else {
      // Throw exception for unmocked methods to identify missing spies
      vi.spyOn(prototype, methodName).mockImplementation((...args: unknown[]) => {
        const errorMsg = `[BDD TEST] Unmocked ${gatewayName}.${methodName}() called with args: ${JSON.stringify(args)}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      });
    }
  });
}

/**
 * Spy on all gateways/repositories that might be called during tests
 * This provides comprehensive coverage and clear error messages for missing mocks
 */
export async function spyOnAllGateways(
  explicitMocks: Record<string, Record<string, unknown>> = {},
) {
  // DXTR Gateways
  const CasesDxtrGatewayModule =
    await import('../../../backend/lib/adapters/gateways/dxtr/cases.dxtr.gateway');
  const CasesDxtrGateway = CasesDxtrGatewayModule.default;
  spyOnAllGatewayMethods(CasesDxtrGateway, 'CasesDxtrGateway', explicitMocks.CasesDxtrGateway);

  const { DxtrCaseDocketGateway } =
    await import('../../../backend/lib/adapters/gateways/dxtr/case-docket.dxtr.gateway');
  spyOnAllGatewayMethods(
    DxtrCaseDocketGateway,
    'DxtrCaseDocketGateway',
    explicitMocks.DxtrCaseDocketGateway,
  );

  const OfficesDxtrGatewayModule =
    await import('../../../backend/lib/adapters/gateways/dxtr/offices.dxtr.gateway');
  const OfficesDxtrGateway = OfficesDxtrGatewayModule.default;
  spyOnAllGatewayMethods(
    OfficesDxtrGateway,
    'OfficesDxtrGateway',
    explicitMocks.OfficesDxtrGateway,
  );

  const { DxtrOrdersGateway } =
    await import('../../../backend/lib/adapters/gateways/dxtr/orders.dxtr.gateway');
  spyOnAllGatewayMethods(DxtrOrdersGateway, 'DxtrOrdersGateway', explicitMocks.DxtrOrdersGateway);

  // ACMS Gateway
  const { AcmsGatewayImpl } =
    await import('../../../backend/lib/adapters/gateways/acms/acms.gateway');
  spyOnAllGatewayMethods(AcmsGatewayImpl, 'AcmsGatewayImpl', explicitMocks.AcmsGatewayImpl);

  // MongoDB Repositories
  const { CasesMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/cases.mongo.repository');
  spyOnAllGatewayMethods(
    CasesMongoRepository,
    'CasesMongoRepository',
    explicitMocks.CasesMongoRepository,
  );

  const { CaseNotesMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/case-notes.mongo.repository');
  spyOnAllGatewayMethods(
    CaseNotesMongoRepository,
    'CaseNotesMongoRepository',
    explicitMocks.CaseNotesMongoRepository,
  );

  const { CaseAssignmentMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/case-assignment.mongo.repository');
  spyOnAllGatewayMethods(
    CaseAssignmentMongoRepository,
    'CaseAssignmentMongoRepository',
    explicitMocks.CaseAssignmentMongoRepository,
  );

  const ConsolidationOrdersMongoRepositoryModule =
    await import('../../../backend/lib/adapters/gateways/mongo/consolidations.mongo.repository');
  const ConsolidationOrdersMongoRepository = ConsolidationOrdersMongoRepositoryModule.default;
  spyOnAllGatewayMethods(
    ConsolidationOrdersMongoRepository,
    'ConsolidationOrdersMongoRepository',
    explicitMocks.ConsolidationOrdersMongoRepository,
  );

  const { OfficesMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/offices.mongo.repository');
  spyOnAllGatewayMethods(
    OfficesMongoRepository,
    'OfficesMongoRepository',
    explicitMocks.OfficesMongoRepository,
  );

  const { OfficeAssigneeMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/office-assignee.mongo.repository');
  spyOnAllGatewayMethods(
    OfficeAssigneeMongoRepository,
    'OfficeAssigneeMongoRepository',
    explicitMocks.OfficeAssigneeMongoRepository,
  );

  const { OrdersMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/orders.mongo.repository');
  spyOnAllGatewayMethods(
    OrdersMongoRepository,
    'OrdersMongoRepository',
    explicitMocks.OrdersMongoRepository,
  );

  const { RuntimeStateMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/runtime-state.mongo.repository');
  spyOnAllGatewayMethods(
    RuntimeStateMongoRepository,
    'RuntimeStateMongoRepository',
    explicitMocks.RuntimeStateMongoRepository,
  );

  const { TrusteesMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/trustees.mongo.repository');
  spyOnAllGatewayMethods(
    TrusteesMongoRepository,
    'TrusteesMongoRepository',
    explicitMocks.TrusteesMongoRepository,
  );

  const { UserGroupsMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/user-groups.mongo.repository');
  spyOnAllGatewayMethods(
    UserGroupsMongoRepository,
    'UserGroupsMongoRepository',
    explicitMocks.UserGroupsMongoRepository,
  );

  const { UsersMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/user.repository');
  spyOnAllGatewayMethods(
    UsersMongoRepository,
    'UsersMongoRepository',
    explicitMocks.UsersMongoRepository,
  );

  const { UserSessionCacheMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/user-session-cache.mongo.repository');
  spyOnAllGatewayMethods(
    UserSessionCacheMongoRepository,
    'UserSessionCacheMongoRepository',
    explicitMocks.UserSessionCacheMongoRepository,
  );

  const { ListsMongoRepository } =
    await import('../../../backend/lib/adapters/gateways/mongo/lists.mongo.repository');
  spyOnAllGatewayMethods(
    ListsMongoRepository,
    'ListsMongoRepository',
    explicitMocks.ListsMongoRepository,
  );
}

/**
 * Clear all repository spies for the current test scope
 * Call this in afterEach to clean up after each test
 *
 * IMPORTANT: Uses vi.restoreAllMocks() which properly restores all
 * mocks to their original implementations. This is safe to call
 * in afterEach without affecting other running tests.
 *
 * Also clears singleton instances that might have cached references to
 * old mock implementations.
 */
export async function clearAllRepositorySpies() {
  // Restore all mocks including repository spies and feature flag spies
  // This prevents cross-test state leakage
  // Note: BDD tests use restoreMocks: false in config and handle cleanup manually
  vi.restoreAllMocks();

  // Clear singleton instances to ensure fresh instances with new spies
  // IMPORTANT: Access the class's private static instance field to reset it
  try {
    const { TrusteesMongoRepository } =
      await import('../../../backend/lib/adapters/gateways/mongo/trustees.mongo.repository');
    // Reset the singleton by accessing the private static field
    // @ts-expect-error - accessing private field for test cleanup
    if (TrusteesMongoRepository.instance) {
      // @ts-expect-error - accessing private field for test cleanup
      TrusteesMongoRepository.instance = undefined;
      // @ts-expect-error - accessing private field for test cleanup
      TrusteesMongoRepository.referenceCount = 0;
    }
  } catch (_e) {
    // Ignore if module not yet loaded
  }
}
