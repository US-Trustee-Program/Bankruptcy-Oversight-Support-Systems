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
import { MockNotificationGateway } from '../../testing/mock-gateways/mock-notification.gateway';

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

const CHAPTER_OVERSIGHT_RECIPIENT: NotificationRecipient = {
  covers: ['chapter:7', 'chapter:11', 'chapter:12', 'chapter:13'],
  recipientAddresses: ['ch-oversight@example.test'],
  displayName: 'Default Chapter Oversight',
};

const ZOOM_341_RECIPIENT: NotificationRecipient = {
  covers: ['category:zoom-341'],
  recipientAddresses: ['zoom-341@example.test'],
  displayName: '341 Meeting Oversight',
};

const SUBV_RECIPIENT: NotificationRecipient = {
  covers: ['chapter:11-subchapter-v'],
  recipientAddresses: ['subv@example.test'],
  displayName: 'Subchapter V Oversight',
};

function seedRouting(rows: NotificationRecipient[]) {
  vi.spyOn(MockMongoRepository.prototype, 'findRecipientByRoutingKey').mockImplementation(
    async (key: string) => {
      for (const row of rows) {
        if (row.covers.includes(key)) return row;
      }
      return null;
    },
  );
}

describe('TrusteeChangeNotificationUseCase', () => {
  let context: ApplicationContext;
  let useCase: TrusteeChangeNotificationUseCase;
  let mockGateway: MockNotificationGateway;

  beforeEach(async () => {
    vi.restoreAllMocks();
    delete process.env.DEFAULT_NOTIFICATION_RECIPIENT;
    context = await createMockApplicationContext();
    mockGateway = MockNotificationGateway.getInstance();
    mockGateway.clear();
    useCase = new TrusteeChangeNotificationUseCase(context);
  });

  afterEach(() => {
    delete process.env.DEFAULT_NOTIFICATION_RECIPIENT;
  });

  test('returns without dispatching when the change set is empty', async () => {
    seedRouting([CHAPTER_OVERSIGHT_RECIPIENT]);

    await useCase.notify(context, buildChangeSet([]));

    expect(mockGateway.getRecorded()).toEqual([]);
  });

  test('dispatches one notification to the chapter oversight recipient for a profile change', async () => {
    seedRouting([CHAPTER_OVERSIGHT_RECIPIENT]);

    await useCase.notify(context, buildChangeSet([buildField()]));

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].to).toBe(CHAPTER_OVERSIGHT_RECIPIENT.recipientAddresses[0]);
    expect(recorded[0].toDisplayName).toBe(CHAPTER_OVERSIGHT_RECIPIENT.displayName);
    expect(recorded[0].subject).toBe('Trustee Information Changed: Henry Green');
    expect(recorded[0].correlationId).toBe(context.invocationId);
  });

  test('dispatches to all addresses when a routing record has multiple recipients', async () => {
    seedRouting([
      {
        ...CHAPTER_OVERSIGHT_RECIPIENT,
        recipientAddresses: ['primary@example.test', 'backup@example.test'],
      },
    ]);

    await useCase.notify(context, buildChangeSet([buildField()]));

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(2);
    const addresses = recorded.map((n) => n.to).sort();
    expect(addresses).toEqual(['backup@example.test', 'primary@example.test']);
  });

  test('falls back to DEFAULT_NOTIFICATION_RECIPIENT env var when no routing record matches', async () => {
    seedRouting([]);
    process.env.DEFAULT_NOTIFICATION_RECIPIENT = 'fallback@example.test';

    await useCase.notify(context, buildChangeSet([buildField()]));

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].to).toBe('fallback@example.test');
  });

  test('dispatches twice for a multi-category change with two unique recipients', async () => {
    seedRouting([CHAPTER_OVERSIGHT_RECIPIENT, ZOOM_341_RECIPIENT]);

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
      [
        CHAPTER_OVERSIGHT_RECIPIENT.recipientAddresses[0],
        ZOOM_341_RECIPIENT.recipientAddresses[0],
      ].sort(),
    );
    for (const n of recorded) {
      expect(n.html).toContain('Name');
      expect(n.html).toContain('Zoom Info');
    }
  });

  test('dedupes recipients case-insensitively when categories resolve to the same address', async () => {
    seedRouting([
      CHAPTER_OVERSIGHT_RECIPIENT,
      { ...ZOOM_341_RECIPIENT, recipientAddresses: ['CH-OVERSIGHT@example.test'] },
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

  test('drops the dispatch with an error log when no record or env var fallback exists', async () => {
    seedRouting([]);
    const errorSpy = vi.spyOn(context.logger, 'error');

    await useCase.notify(context, buildChangeSet([buildField()]));

    expect(mockGateway.getRecorded()).toEqual([]);
    expect(errorSpy).toHaveBeenCalled();
    expect(errorSpy.mock.calls[0][1]).toContain('No routing record for key');
  });

  test('routes a SubV profile change to the SubV recipient', async () => {
    seedRouting([CHAPTER_OVERSIGHT_RECIPIENT, SUBV_RECIPIENT]);

    await useCase.notify(
      context,
      buildChangeSet([buildField()], { primaryChapter: '11-subchapter-v' }),
    );

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].to).toBe(SUBV_RECIPIENT.recipientAddresses[0]);
  });

  test('skips notification for a profile change with no primaryChapter', async () => {
    seedRouting([CHAPTER_OVERSIGHT_RECIPIENT]);

    await useCase.notify(context, buildChangeSet([buildField()], { primaryChapter: undefined }));

    expect(mockGateway.getRecorded()).toEqual([]);
  });

  test('groups dispatch by category, not by field count', async () => {
    seedRouting([CHAPTER_OVERSIGHT_RECIPIENT]);

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

  test('sets replyTo from changeSet author email when present', async () => {
    seedRouting([CHAPTER_OVERSIGHT_RECIPIENT]);

    await useCase.notify(
      context,
      buildChangeSet([buildField()], {
        author: { name: 'Jane Doe', email: 'jane@example.test' },
      }),
    );

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].replyTo).toEqual({
      address: 'jane@example.test',
      displayName: 'Jane Doe',
    });
  });

  test('omits replyTo when changeSet author has no email', async () => {
    seedRouting([CHAPTER_OVERSIGHT_RECIPIENT]);

    await useCase.notify(
      context,
      buildChangeSet([buildField()], {
        author: { name: 'Jane Doe' },
      }),
    );

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].replyTo).toBeUndefined();
  });

  test('omits replyTo when changeSet has no author', async () => {
    seedRouting([CHAPTER_OVERSIGHT_RECIPIENT]);

    await useCase.notify(context, buildChangeSet([buildField()]));

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].replyTo).toBeUndefined();
  });

  test('correlationId on each notification matches the context invocationId', async () => {
    seedRouting([CHAPTER_OVERSIGHT_RECIPIENT, ZOOM_341_RECIPIENT]);

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
