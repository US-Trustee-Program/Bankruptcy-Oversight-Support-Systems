import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import {
  NotificationRecipient,
  TrusteeChangeField,
  TrusteeChangeSet,
} from '@common/cams/notifications';
import { TrusteeChangeNotificationUseCase } from './trustee-change-notification';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MockNotificationGateway } from '../../adapters/gateways/notifications/mock-notification.gateway';

function buildField(overrides: Partial<TrusteeChangeField> = {}): TrusteeChangeField {
  return {
    label: 'Public Contact',
    before: 'old@example.test',
    after: 'new@example.test',
    category: 'profile',
    section: 'appointment',
    ...overrides,
  };
}

function buildChangeSet(
  fields: TrusteeChangeField[],
  overrides: Partial<TrusteeChangeSet> = {},
): TrusteeChangeSet {
  return {
    trusteeId: 'trustee-1',
    trusteeName: 'Henry Green',
    fields,
    primaryChapter: '7',
    ...overrides,
  };
}

const CHAPTER_7_RECIPIENT: NotificationRecipient = {
  key: 'chapter:7',
  recipientAddress: 'ch7-oversight@example.test',
  displayName: 'CH7 Oversight',
};

const ZOOM_341_RECIPIENT: NotificationRecipient = {
  key: 'category:zoom-341',
  recipientAddress: 'ustp-help@example.test',
  displayName: 'USTP Help',
};

const DEFAULT_RECIPIENT: NotificationRecipient = {
  key: 'default',
  recipientAddress: 'default-oversight@example.test',
  displayName: 'Default Oversight',
};

function seedRouting(rows: NotificationRecipient[]) {
  // The factory returns a fresh MockMongoRepository per call, so seed via the
  // prototype method on every instance MockMongoRepository hands out. The map
  // is per-instance, so we instead spy on findRecipientByKey directly to
  // control routing resolution from the test.
  const routingMap = new Map(rows.map((r) => [r.key, r]));
  vi.spyOn(MockMongoRepository.prototype, 'findRecipientByKey').mockImplementation(
    async (key: string) => routingMap.get(key) ?? null,
  );
  vi.spyOn(MockMongoRepository.prototype, 'getDefaultRecipient').mockImplementation(async () => {
    const def = routingMap.get('default');
    if (!def) throw new Error('Notification routing default recipient is not seeded.');
    return def;
  });
}

describe('TrusteeChangeNotificationUseCase', () => {
  let context: ApplicationContext;
  let useCase: TrusteeChangeNotificationUseCase;
  let mockGateway: MockNotificationGateway;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    mockGateway = MockNotificationGateway.getInstance();
    mockGateway.clear();
    useCase = new TrusteeChangeNotificationUseCase(context);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockGateway.clear();
  });

  test('returns without dispatching when the change set is empty', async () => {
    seedRouting([CHAPTER_7_RECIPIENT, DEFAULT_RECIPIENT]);

    await useCase.notify(context, buildChangeSet([]));

    expect(mockGateway.getRecorded()).toEqual([]);
  });

  test('dispatches one notification to the chapter:7 recipient for a profile-only change', async () => {
    seedRouting([CHAPTER_7_RECIPIENT, DEFAULT_RECIPIENT]);

    await useCase.notify(context, buildChangeSet([buildField()]));

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].to).toBe(CHAPTER_7_RECIPIENT.recipientAddress);
    expect(recorded[0].toDisplayName).toBe(CHAPTER_7_RECIPIENT.displayName);
    expect(recorded[0].subject).toBe('Trustee Information Changed: Henry Green');
    expect(recorded[0].correlationId).toBe(context.invocationId);
  });

  test('falls back to the default recipient when the chapter rule is missing', async () => {
    seedRouting([DEFAULT_RECIPIENT]); // no chapter:7 row
    const warnSpy = vi.spyOn(context.logger, 'warn');

    await useCase.notify(context, buildChangeSet([buildField()]));

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].to).toBe(DEFAULT_RECIPIENT.recipientAddress);
    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][1]).toContain("No routing rule for key 'chapter:7'");
  });

  test('dispatches twice for a multi-category change with two unique recipients', async () => {
    seedRouting([CHAPTER_7_RECIPIENT, ZOOM_341_RECIPIENT, DEFAULT_RECIPIENT]);

    await useCase.notify(
      context,
      buildChangeSet([
        buildField({ label: 'Name', category: 'profile', section: 'appointment' }),
        buildField({
          label: 'Zoom Info',
          category: 'zoom-341',
          section: 'meeting',
          before: 'old',
          after: 'new',
        }),
      ]),
    );

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(2);
    const addresses = recorded.map((n) => n.to).sort();
    expect(addresses).toEqual(
      [CHAPTER_7_RECIPIENT.recipientAddress, ZOOM_341_RECIPIENT.recipientAddress].sort(),
    );
    // Both notifications carry the FULL compiled body — both labels appear in each.
    for (const n of recorded) {
      expect(n.html).toContain('Name');
      expect(n.html).toContain('Zoom Info');
    }
  });

  test('dedupes recipients case-insensitively when categories resolve to the same address', async () => {
    seedRouting([
      CHAPTER_7_RECIPIENT,
      // Same address as chapter:7, just different casing — must dedupe.
      { ...ZOOM_341_RECIPIENT, recipientAddress: 'CH7-OVERSIGHT@example.test' },
      DEFAULT_RECIPIENT,
    ]);

    await useCase.notify(
      context,
      buildChangeSet([
        buildField({ category: 'profile', section: 'appointment' }),
        buildField({
          label: 'Zoom Info',
          category: 'zoom-341',
          section: 'meeting',
          before: 'old',
          after: 'new',
        }),
      ]),
    );

    expect(mockGateway.getRecorded()).toHaveLength(1);
  });

  test('drops the dispatch with an error log when no specific or default recipient is available', async () => {
    seedRouting([]); // no rows at all
    const errorSpy = vi.spyOn(context.logger, 'error');

    await useCase.notify(context, buildChangeSet([buildField()]));

    expect(mockGateway.getRecorded()).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][1]).toContain('Default recipient missing from routing config');
  });

  test('routes a profile change with no primaryChapter to the default recipient', async () => {
    seedRouting([CHAPTER_7_RECIPIENT, DEFAULT_RECIPIENT]);

    await useCase.notify(context, buildChangeSet([buildField()], { primaryChapter: undefined }));

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].to).toBe(DEFAULT_RECIPIENT.recipientAddress);
  });

  test('groups dispatch by category, not by field count', async () => {
    seedRouting([CHAPTER_7_RECIPIENT, DEFAULT_RECIPIENT]);

    // Three profile-category fields — should still resolve to a single recipient.
    await useCase.notify(
      context,
      buildChangeSet([
        buildField({ label: 'Name' }),
        buildField({ label: 'Public Contact' }),
        buildField({ label: 'Software' }),
      ]),
    );

    expect(mockGateway.getRecorded()).toHaveLength(1);
  });

  test('correlationId on each notification matches the context invocationId', async () => {
    seedRouting([CHAPTER_7_RECIPIENT, ZOOM_341_RECIPIENT, DEFAULT_RECIPIENT]);

    await useCase.notify(
      context,
      buildChangeSet([
        buildField({ category: 'profile', section: 'appointment' }),
        buildField({
          label: 'Zoom Info',
          category: 'zoom-341',
          section: 'meeting',
          before: 'old',
          after: 'new',
        }),
      ]),
    );

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(2);
    for (const n of recorded) {
      expect(n.correlationId).toBe(context.invocationId);
    }
  });
});
