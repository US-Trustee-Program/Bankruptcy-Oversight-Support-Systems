import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import HttpStatusCodes from '@common/api/http-status-codes';
import { CamsController } from '../controller';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { TrusteeNotesUseCase } from '../../use-cases/trustee-notes/trustee-notes';
import {
  TrusteeNote,
  TrusteeNoteDeleteRequest,
  TrusteeNoteEditRequest,
  TrusteeNoteInput,
} from '@common/cams/trustee-notes';
import { ForbiddenTrusteeNotesError } from './trustee-notes.exception';
import { ResourceActions } from '@common/cams/actions';

const MODULE_NAME = 'TRUSTEE-NOTES-CONTROLLER';
const VALID_ID_PATTERN = RegExp(/^[\dA-Za-z]+(-[\dA-Za-z]+)*$/);
const INVALID_ID_MESSAGE = 'trustee note ID must be provided.';

export class TrusteeNotesController implements CamsController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.applicationContext = context;
  }

  public async handleRequest(
    context: ApplicationContext<TrusteeNoteInput>,
  ): Promise<CamsHttpResponseInit | CamsHttpResponseInit<ResourceActions<TrusteeNote>[]>> {
    try {
      const trusteeNotesUseCase = new TrusteeNotesUseCase(context);
      if (context.request.method === 'POST') {
        const { trusteeId } = context.request.params;
        const { content, title } = context.request.body;
        const noteInput: TrusteeNoteInput = {
          trusteeId,
          title,
          content,
        };
        this.validateRequestParameters(noteInput);
        await trusteeNotesUseCase.createTrusteeNote(context.session.user, noteInput);
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
        });
      } else if (context.request.method === 'DELETE') {
        const { trusteeId, noteId } = context.request.params;
        const archiveNote: TrusteeNoteDeleteRequest = {
          id: noteId,
          trusteeId,
          sessionUser: context.session.user,
        };
        this.validateArchiveRequestParameters({ id: noteId, trusteeId });
        await trusteeNotesUseCase.archiveTrusteeNote(archiveNote);
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
        });
      } else if (context.request.method === 'PUT') {
        const note = context.request.body;
        const { trusteeId, noteId } = context.request.params;
        const noteForRequest = {
          ...note,
          id: noteId,
          trusteeId,
        };
        this.validateRequestParameters(noteForRequest);
        const request: TrusteeNoteEditRequest = {
          note: noteForRequest,
          sessionUser: context.session.user,
        };

        const newNote = await trusteeNotesUseCase.editTrusteeNote(request);
        return httpSuccess({
          statusCode: HttpStatusCodes.CREATED,
          body: {
            data: [newNote],
          },
        });
      } else {
        const trusteeNotes = await trusteeNotesUseCase.getTrusteeNotes(
          context.request.params.trusteeId,
        );
        return httpSuccess({
          body: { data: trusteeNotes },
          statusCode: HttpStatusCodes.CREATED,
        });
      }
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }

  private validateRequestParameters(input: Partial<TrusteeNoteInput>) {
    const badParams = [];
    const messages = [];

    if (!input.trusteeId) {
      badParams.push('trusteeId');
    }

    if (!input.title) {
      badParams.push('trustee note title');
    }

    if (!input.content) {
      badParams.push('trustee note content');
    }

    if (badParams.length > 0) {
      const isPlural = badParams.length > 1;
      const message = `Required ${isPlural ? 'parameters' : 'parameter'} ${badParams.join(', ')} ${isPlural ? 'are' : 'is'} absent.`;
      messages.push(message);
    }
    if (messages.length) {
      throw new ForbiddenTrusteeNotesError(MODULE_NAME, { message: messages.join(' ') });
    }
  }

  private validateArchiveRequestParameters(request: Partial<TrusteeNoteDeleteRequest>) {
    const badParams = [];
    const messages = [];

    if (!request['id']) {
      badParams.push('id');
    } else if (!request['id'].match(VALID_ID_PATTERN)) {
      messages.push(INVALID_ID_MESSAGE);
    }

    if (!request['trusteeId']) {
      badParams.push('trusteeId');
    }

    if (badParams.length > 0) {
      const isPlural = badParams.length > 1;
      const message = `Required ${isPlural ? 'parameters' : 'parameter'} ${badParams.join(', ')} ${isPlural ? 'are' : 'is'} absent.`;
      messages.push(message);
    }
    if (messages.length) {
      throw new ForbiddenTrusteeNotesError(MODULE_NAME, { message: messages.join(' ') });
    }
  }
}
