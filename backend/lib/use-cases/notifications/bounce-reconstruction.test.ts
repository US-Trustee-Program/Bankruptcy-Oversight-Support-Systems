import { vi } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { TrusteeChangeSet } from '@common/cams/notifications';
import { BounceReconstructionUseCase } from './bounce-reconstruction';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MockNotificationGateway } from '../../testing/mock-gateways/mock-notification.gateway';
import { EmailNotificationArchiveRecord } from '../../use-cases/gateways.types';
import { NotFoundError } from '../../common-errors/not-found-error';

function buildChangeSet(overrides: Partial<TrusteeChangeSet> = {}): TrusteeChangeSet {
  return {
    trusteeId: 'trustee-1',
    trusteeName: 'Henry Green',
    fields: [
      {
        label: 'Public Contact',
        comparisons: [{ before: 'old@example.test', after: 'new@example.test' }],
        category: 'profile',
        section: 'appointment',
      },
    ],
    chapters: ['7'],
    ...overrides,
  };
}

describe('BounceReconstructionUseCase', () => {
  let context: ApplicationContext;
  let useCase: BounceReconstructionUseCase;
  let mockGateway: MockNotificationGateway;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    mockGateway = MockNotificationGateway.getInstance();
    mockGateway.clear();
    useCase = new BounceReconstructionUseCase(context);
  });

  test('reconstructs the original email and sends it to the admin', async () => {
    const changeSet = buildChangeSet();
    const archived: EmailNotificationArchiveRecord = {
      messageId: 'msg-1',
      recipientAddress: 'ch-oversight@example.test',
      changeSet,
    };
    vi.spyOn(MockMongoRepository.prototype, 'readArchivedEmail').mockResolvedValue(archived);

    await useCase.reconstructAndForward(context, 'msg-1', 'admin@example.test');

    const recorded = mockGateway.getRecorded();
    expect(recorded).toHaveLength(1);
    expect(recorded[0].to).toBe('admin@example.test');
    expect(recorded[0].subject).toBe('[Bounced] Trustee Information Changed: Henry Green');
    expect(recorded[0].html).toContain('ch-oversight@example.test');
    expect(recorded[0].html).toContain('<hr>');
    expect(recorded[0].html).toContain('old@example.test');
    expect(recorded[0].html).toContain('new@example.test');
    expect(recorded[0].html).toContain('Be sure this information is forwarded on to OO.');
    expect(recorded[0].html.indexOf('forwarded on to OO')).toBeLessThan(
      recorded[0].html.indexOf('<hr>'),
    );
    expect(recorded[0].text).toContain('ch-oversight@example.test');
    expect(recorded[0].text).toContain('Public Contact: old@example.test -> new@example.test');
    expect(recorded[0].text).toContain('Be sure this information is forwarded on to OO.');
    expect(recorded[0].text.indexOf('forwarded on to OO')).toBeLessThan(
      recorded[0].text.indexOf('Public Contact'),
    );
    expect(recorded[0].correlationId).toBe(context.invocationId);
  });

  test('escapes the original recipient address in the html body', async () => {
    const archived: EmailNotificationArchiveRecord = {
      messageId: 'msg-1',
      recipientAddress: '<script>alert(1)</script>@example.test',
      changeSet: buildChangeSet(),
    };
    vi.spyOn(MockMongoRepository.prototype, 'readArchivedEmail').mockResolvedValue(archived);

    await useCase.reconstructAndForward(context, 'msg-1', 'admin@example.test');

    const recorded = mockGateway.getRecorded();
    expect(recorded[0].html).not.toContain('<script>');
    expect(recorded[0].html).toContain('&lt;script&gt;');
  });

  test('throws NotFoundError when no archived record exists for the messageId', async () => {
    vi.spyOn(MockMongoRepository.prototype, 'readArchivedEmail').mockResolvedValue(null);

    await expect(
      useCase.reconstructAndForward(context, 'missing-message-id', 'admin@example.test'),
    ).rejects.toThrow(NotFoundError);

    expect(mockGateway.getRecorded()).toEqual([]);
  });

  test('logs a success line with the messageId and original recipient after forwarding', async () => {
    const archived: EmailNotificationArchiveRecord = {
      messageId: 'msg-1',
      recipientAddress: 'ch-oversight@example.test',
      changeSet: buildChangeSet(),
    };
    vi.spyOn(MockMongoRepository.prototype, 'readArchivedEmail').mockResolvedValue(archived);
    const infoSpy = vi.spyOn(context.logger, 'info');

    await useCase.reconstructAndForward(context, 'msg-1', 'admin@example.test', 'Bounced');

    expect(infoSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/msg-1.*ch-oversight@example\.test/),
    );
  });

  test('logs a warning when the delivery status indicates the recipient is suppressed', async () => {
    const archived: EmailNotificationArchiveRecord = {
      messageId: 'msg-1',
      recipientAddress: 'ch-oversight@example.test',
      changeSet: buildChangeSet(),
    };
    vi.spyOn(MockMongoRepository.prototype, 'readArchivedEmail').mockResolvedValue(archived);
    const warnSpy = vi.spyOn(context.logger, 'warn');

    await useCase.reconstructAndForward(context, 'msg-1', 'admin@example.test', 'Suppressed');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("'ch-oversight@example.test' is on ACS's suppression list"),
    );
  });

  test('does not log a suppression warning for an ordinary bounce', async () => {
    const archived: EmailNotificationArchiveRecord = {
      messageId: 'msg-1',
      recipientAddress: 'ch-oversight@example.test',
      changeSet: buildChangeSet(),
    };
    vi.spyOn(MockMongoRepository.prototype, 'readArchivedEmail').mockResolvedValue(archived);
    const warnSpy = vi.spyOn(context.logger, 'warn');

    await useCase.reconstructAndForward(context, 'msg-1', 'admin@example.test', 'Bounced');

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
