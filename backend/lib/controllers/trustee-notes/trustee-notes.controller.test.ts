import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import {
  createMockApplicationContext,
  createMockApplicationContextSession,
} from '../../testing/testing-utilities';
import { CamsRole } from '@common/cams/roles';
import { REGION_02_GROUP_NY } from '@common/cams/test-utilities/mock-user';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeNotesUseCase } from '../../use-cases/trustee-notes/trustee-notes';
import { TrusteeNotesController } from './trustee-notes.controller';
import { mockCamsHttpRequest } from '../../testing/mock-data/cams-http-request-helper';
import { getCamsError } from '../../common-errors/error-utilities';
import { randomUUID } from 'crypto';
import { TrusteeNoteDeleteRequest, TrusteeNoteInput } from '@common/cams/trustee-notes';
import { getCamsUserReference } from '@common/cams/session';

describe('Trustee note controller tests', () => {
  let applicationContext: ApplicationContext<TrusteeNoteInput>;

  const user = {
    ...MockData.getCamsUserReference(),
    name: 'Mock Name',
    offices: [REGION_02_GROUP_NY],
    roles: [CamsRole.TrusteeAdmin],
  };

  beforeEach(async () => {
    applicationContext = await createMockApplicationContext<TrusteeNoteInput>();
    applicationContext.session = await createMockApplicationContextSession({ user });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should call createTrusteeNote on POST with valid note', async () => {
    const createSpy = vi
      .spyOn(TrusteeNotesUseCase.prototype, 'createTrusteeNote')
      .mockResolvedValue();

    const trusteeId = randomUUID();
    const body: TrusteeNoteInput = {
      trusteeId,
      title: 'test note title',
      content: 'some test string',
    };

    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: { trusteeId },
      body,
    });
    const controller = new TrusteeNotesController(applicationContext);
    await controller.handleRequest(applicationContext);

    expect(createSpy).toHaveBeenCalled();
  });

  test('should call getTrusteeNotes on GET', async () => {
    const note = MockData.getTrusteeNote();
    const getSpy = vi
      .spyOn(TrusteeNotesUseCase.prototype, 'getTrusteeNotes')
      .mockResolvedValue([note]);

    applicationContext.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: note.trusteeId },
    });
    const controller = new TrusteeNotesController(applicationContext);
    await controller.handleRequest(applicationContext);

    expect(getSpy).toHaveBeenCalled();
  });

  test('should throw error when no trusteeId is provided on POST', async () => {
    vi.spyOn(TrusteeNotesUseCase.prototype, 'createTrusteeNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest({
      method: 'POST',
      params: { trusteeId: '' },
      body: {
        trusteeId: undefined,
        title: undefined,
        content: undefined,
      },
    });
    const controller = new TrusteeNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameters trusteeId, trustee note title, trustee note content are absent.',
    );
  });

  test('should throw error when no title is provided on POST', async () => {
    vi.spyOn(TrusteeNotesUseCase.prototype, 'createTrusteeNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest<TrusteeNoteInput>({
      method: 'POST',
      params: { trusteeId: randomUUID() },
      body: {
        trusteeId: undefined,
        title: undefined,
        content: 'some content',
      },
    });
    const controller = new TrusteeNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameter trustee note title is absent.',
    );
  });

  test('should throw error when no content is provided on POST', async () => {
    vi.spyOn(TrusteeNotesUseCase.prototype, 'createTrusteeNote').mockResolvedValue();
    applicationContext.request = mockCamsHttpRequest<TrusteeNoteInput>({
      method: 'POST',
      params: { trusteeId: randomUUID() },
      body: {
        trusteeId: undefined,
        title: 'a title',
        content: undefined,
      },
    });
    const controller = new TrusteeNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameter trustee note content is absent.',
    );
  });

  test('should handle errors thrown from useCase on GET', async () => {
    const error = new Error('Trustee notes test error');
    vi.spyOn(TrusteeNotesUseCase.prototype, 'getTrusteeNotes').mockRejectedValue(error);
    applicationContext.request = mockCamsHttpRequest({
      method: 'GET',
      params: { trusteeId: randomUUID() },
    });
    const expectedCamsError = getCamsError(error, 'TRUSTEE-NOTES-CONTROLLER');
    const controller = new TrusteeNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(expectedCamsError);
  });

  test('should call archiveTrusteeNote on DELETE', async () => {
    const archiveNote = MockData.getTrusteeNoteDeletion({ id: randomUUID() });
    const archiveSpy = vi
      .spyOn(TrusteeNotesUseCase.prototype, 'archiveTrusteeNote')
      .mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    const expectedRequest: TrusteeNoteDeleteRequest = {
      id: archiveNote.id,
      trusteeId: archiveNote.trusteeId,
      sessionUser: applicationContext.session.user,
    };

    applicationContext.request = mockCamsHttpRequest({
      method: 'DELETE',
      params: {
        noteId: archiveNote.id,
        trusteeId: archiveNote.trusteeId,
      },
    });
    const controller = new TrusteeNotesController(applicationContext);
    await controller.handleRequest(applicationContext);
    expect(archiveSpy).toHaveBeenCalledWith(expectedRequest);
  });

  test('should throw error when archiveTrusteeNote throws an error', async () => {
    const archiveNote = MockData.getTrusteeNoteDeletion({ id: randomUUID() });
    const error = new Error('Trustee notes test error');
    const expectedCamsError = getCamsError(error, 'TRUSTEE-NOTES-CONTROLLER');
    vi.spyOn(TrusteeNotesUseCase.prototype, 'archiveTrusteeNote').mockRejectedValue(error);

    applicationContext.request = mockCamsHttpRequest({
      method: 'DELETE',
      params: {
        trusteeId: archiveNote.trusteeId,
        noteId: archiveNote.id,
      },
    });
    const controller = new TrusteeNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(expectedCamsError);
  });

  const goodNote = MockData.getTrusteeNote({ updatedBy: user });
  const deleteTestParams = [
    ['noteId', undefined, goodNote.trusteeId],
    ['noteId', '@#$%', goodNote.trusteeId],
    ['trusteeId', goodNote.id, undefined],
    ['all params', undefined, undefined],
  ];

  test.each(deleteTestParams)(
    'should fail archive request when params are missing %s',
    async (_testCase: string, id: string | undefined, trusteeId: string | undefined) => {
      applicationContext.request = mockCamsHttpRequest({
        method: 'DELETE',
        params: { noteId: id, trusteeId },
      });
      const controller = new TrusteeNotesController(applicationContext);
      await expect(controller.handleRequest(applicationContext)).rejects.toThrow();
    },
  );

  test('should call editTrusteeNote on PUT with valid request', async () => {
    const trusteeId = randomUUID();
    const testNote = MockData.getTrusteeNote({
      trusteeId,
      updatedBy: getCamsUserReference(user),
    });
    const editSpy = vi
      .spyOn(TrusteeNotesUseCase.prototype, 'editTrusteeNote')
      .mockResolvedValue({ ...testNote });

    applicationContext.request = mockCamsHttpRequest<TrusteeNoteInput>({
      method: 'PUT',
      params: {
        trusteeId,
        noteId: testNote.id,
      },
      body: {
        trusteeId,
        title: 'test note title',
        content: 'some test string',
      },
    });
    const controller = new TrusteeNotesController(applicationContext);
    await controller.handleRequest(applicationContext);

    expect(editSpy).toHaveBeenCalled();
  });

  test('should throw error when no title is provided on PUT', async () => {
    applicationContext.request = mockCamsHttpRequest<TrusteeNoteInput>({
      method: 'PUT',
      params: { trusteeId: randomUUID(), noteId: randomUUID() },
      body: {
        trusteeId: undefined,
        title: undefined,
        content: 'some content',
      },
    });
    const controller = new TrusteeNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameter trustee note title is absent.',
    );
  });

  test('should throw error when no content is provided on PUT', async () => {
    applicationContext.request = mockCamsHttpRequest<TrusteeNoteInput>({
      method: 'PUT',
      params: { trusteeId: randomUUID(), noteId: randomUUID() },
      body: {
        trusteeId: undefined,
        title: 'a title',
        content: undefined,
      },
    });
    const controller = new TrusteeNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(
      'Required parameter trustee note content is absent.',
    );
  });

  test('should handle errors thrown from useCase on PUT', async () => {
    const error = new Error('Trustee notes PUT error');
    vi.spyOn(TrusteeNotesUseCase.prototype, 'editTrusteeNote').mockRejectedValue(error);
    const trusteeId = randomUUID();
    applicationContext.request = mockCamsHttpRequest<TrusteeNoteInput>({
      method: 'PUT',
      params: { trusteeId, noteId: randomUUID() },
      body: {
        trusteeId,
        title: 'a title',
        content: 'some content',
      },
    });
    const expectedCamsError = getCamsError(error, 'TRUSTEE-NOTES-CONTROLLER');
    const controller = new TrusteeNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(expectedCamsError);
  });

  test('should handle errors thrown from useCase on POST', async () => {
    const error = new Error('Trustee notes POST error');
    vi.spyOn(TrusteeNotesUseCase.prototype, 'createTrusteeNote').mockRejectedValue(error);
    const trusteeId = randomUUID();
    applicationContext.request = mockCamsHttpRequest<TrusteeNoteInput>({
      method: 'POST',
      params: { trusteeId },
      body: { trusteeId, title: 'a title', content: 'some content' },
    });
    const expectedCamsError = getCamsError(error, 'TRUSTEE-NOTES-CONTROLLER');
    const controller = new TrusteeNotesController(applicationContext);
    await expect(controller.handleRequest(applicationContext)).rejects.toThrow(expectedCamsError);
  });
});
