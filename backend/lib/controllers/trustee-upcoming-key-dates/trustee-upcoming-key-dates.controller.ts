import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import HttpStatusCodes from '@common/api/http-status-codes';
import { CamsController } from '../controller';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { TrusteeUpcomingKeyDatesUseCase } from '../../use-cases/trustee-upcoming-key-dates/trustee-upcoming-key-dates';
import { BadRequestError } from '../../common-errors/bad-request';
import {
  DATE_FIELDS,
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesInput,
  validateTrusteeUpcomingKeyDates,
} from '@common/cams/trustee-upcoming-key-dates';
import Validators from '@common/cams/validators';
import { NotFoundError } from '../../common-errors/not-found-error';

const MODULE_NAME = 'TRUSTEE-UPCOMING-KEY-DATES-CONTROLLER';

export class TrusteeUpcomingKeyDatesController implements CamsController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.applicationContext = context;
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<CamsHttpResponseInit | CamsHttpResponseInit<TrusteeUpcomingKeyDates>> {
    try {
      if (!context.featureFlags['display-chpt7-panel-upcoming-key-dates']) {
        throw new NotFoundError(MODULE_NAME);
      }
      const { trusteeId, appointmentId } = context.request.params;

      if (!trusteeId || !appointmentId) {
        const missing = [!trusteeId && 'trusteeId', !appointmentId && 'appointmentId']
          .filter(Boolean)
          .join(', ');
        throw new BadRequestError(MODULE_NAME, {
          message: `Required parameter${missing.includes(',') ? 's' : ''} ${missing} ${missing.includes(',') ? 'are' : 'is'} absent.`,
        });
      }

      const useCase = new TrusteeUpcomingKeyDatesUseCase(context);

      if (context.request.method === 'PUT') {
        const input = context.request.body as TrusteeUpcomingKeyDatesInput;
        const invalidFields = DATE_FIELDS.filter(
          (field) => input[field] !== null && !Validators.isValidDate(input[field]).valid,
        );
        if (invalidFields.length > 0) {
          throw new BadRequestError(MODULE_NAME, {
            message: `Invalid ISO date in field(s): ${invalidFields.join(', ')}`,
          });
        }
        const validationResult = validateTrusteeUpcomingKeyDates(input);
        if (!validationResult.valid) {
          const messages = Object.values(validationResult.reasonMap ?? {})
            .flatMap((r) => r.reasons)
            .join(' ');
          throw new BadRequestError(MODULE_NAME, { message: messages });
        }

        await useCase.upsertUpcomingKeyDates(trusteeId, appointmentId, input, context.session.user);
        return httpSuccess({ statusCode: HttpStatusCodes.OK });
      }

      const result = await useCase.getUpcomingKeyDates(appointmentId);

      return httpSuccess({
        body: { data: result },
        statusCode: HttpStatusCodes.OK,
      });
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
