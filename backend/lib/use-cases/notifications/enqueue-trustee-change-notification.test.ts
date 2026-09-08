import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeChangeSet } from '@common/cams/notifications';
import { ApiToDataflowsGateway } from '../gateways.types';
import { enqueueTrusteeChangeNotification } from './enqueue-trustee-change-notification';

function buildChangeSet(): TrusteeChangeSet {
  return {
    trusteeId: 'trustee-1',
    trusteeName: 'Henry Green',
    fields: [
      {
        label: 'Name',
        comparisons: [{ before: 'Henry Green', after: 'Henry G. Green' }],
        category: 'profile',
        section: 'appointment',
      },
    ],
  };
}

function buildGateway(): ApiToDataflowsGateway {
  return {
    queueTrusteeChangeNotification: vi.fn().mockResolvedValue(undefined),
    queueCaseAssignmentEvent: vi.fn(),
    queueTrusteeAppointmentEvent: vi.fn(),
    queueCaseReload: vi.fn(),
    queueTrusteeVerificationRemap: vi.fn(),
  };
}

describe('enqueueTrusteeChangeNotification', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    // createMockApplicationContext() reassigns process.env wholesale, so vi.stubEnv bookkeeping
    // can't be relied on here -- see the matching comment in trustees.test.ts.
    delete process.env.CAMS_FRONTEND_URL;
  });

  test('enriches the changeSet with author and changedAt, and enqueues it', async () => {
    const changeSet = buildChangeSet();
    const gateway = buildGateway();

    await enqueueTrusteeChangeNotification(context, gateway, changeSet, 'trustee-1');

    expect(changeSet.author).toEqual({
      name: context.session.user.name,
      email: context.session.user.email,
    });
    expect(changeSet.changedAt).toEqual(expect.any(String));
    expect(new Date(changeSet.changedAt!).toString()).not.toBe('Invalid Date');
    expect(gateway.queueTrusteeChangeNotification).toHaveBeenCalledWith({ changeSet });
  });

  test('sets profileLink when CAMS_FRONTEND_URL is a valid https URL', async () => {
    process.env.CAMS_FRONTEND_URL = 'https://cams.ustp.gov';
    const changeSet = buildChangeSet();
    const gateway = buildGateway();

    await enqueueTrusteeChangeNotification(context, gateway, changeSet, 'trustee-1');

    expect(changeSet.profileLink).toBe('https://cams.ustp.gov/trustees/trustee-1');
  });

  test('trims a trailing slash from CAMS_FRONTEND_URL before building profileLink', async () => {
    process.env.CAMS_FRONTEND_URL = 'https://cams.ustp.gov/';
    const changeSet = buildChangeSet();
    const gateway = buildGateway();

    await enqueueTrusteeChangeNotification(context, gateway, changeSet, 'trustee-1');

    expect(changeSet.profileLink).toBe('https://cams.ustp.gov/trustees/trustee-1');
  });

  test('omits profileLink when CAMS_FRONTEND_URL is not set', async () => {
    delete process.env.CAMS_FRONTEND_URL;
    const changeSet = buildChangeSet();
    const gateway = buildGateway();

    await enqueueTrusteeChangeNotification(context, gateway, changeSet, 'trustee-1');

    expect(changeSet.profileLink).toBeUndefined();
  });

  test('omits profileLink when CAMS_FRONTEND_URL does not match the https?:// pattern', async () => {
    process.env.CAMS_FRONTEND_URL = 'not-a-url';
    const changeSet = buildChangeSet();
    const gateway = buildGateway();

    await enqueueTrusteeChangeNotification(context, gateway, changeSet, 'trustee-1');

    expect(changeSet.profileLink).toBeUndefined();
  });

  test('propagates a rejection from the gateway without catching it', async () => {
    const changeSet = buildChangeSet();
    const gateway = buildGateway();
    vi.mocked(gateway.queueTrusteeChangeNotification).mockRejectedValue(
      new Error('queue unavailable'),
    );

    await expect(
      enqueueTrusteeChangeNotification(context, gateway, changeSet, 'trustee-1'),
    ).rejects.toThrow('queue unavailable');
  });
});
