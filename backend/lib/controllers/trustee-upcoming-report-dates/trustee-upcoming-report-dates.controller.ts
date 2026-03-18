import { ApplicationContext } from '../../adapters/types/basic';
import { CamsHttpResponseInit, httpSuccess } from '../../adapters/utils/http-response';
import HttpStatusCodes from '@common/api/http-status-codes';
import { CamsController } from '../controller';
import { getCamsError } from '../../common-errors/error-utilities';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import { TrusteeUpcomingReportDatesUseCase } from '../../use-cases/trustee-upcoming-report-dates/trustee-upcoming-report-dates';
import { BadRequestError } from '../../common-errors/bad-request';
import {
  DATE_FIELDS,
  TrusteeUpcomingReportDates,
  TrusteeUpcomingReportDatesInput,
} from '@common/cams/trustee-upcoming-report-dates';
import Validators from '@common/cams/validators';

const MODULE_NAME = 'TRUSTEE-UPCOMING-REPORT-DATES-CONTROLLER';

export class TrusteeUpcomingReportDatesController implements CamsController {
  private readonly applicationContext: ApplicationContext;

  constructor(context: ApplicationContext) {
    this.applicationContext = context;
  }

  public async handleRequest(
    context: ApplicationContext,
  ): Promise<
    CamsHttpResponseInit | CamsHttpResponseInit<{ data: TrusteeUpcomingReportDates | null }>
  > {
    try {
      const { trusteeId, appointmentId } = context.request.params;

      if (!trusteeId || !appointmentId) {
        const missing = [!trusteeId && 'trusteeId', !appointmentId && 'appointmentId']
          .filter(Boolean)
          .join(', ');
        throw new BadRequestError(MODULE_NAME, {
          message: `Required parameter${missing.includes(',') ? 's' : ''} ${missing} ${missing.includes(',') ? 'are' : 'is'} absent.`,
        });
      }

      const useCase = new TrusteeUpcomingReportDatesUseCase(context);

      if (context.request.method === 'PUT') {
        const input = context.request.body as TrusteeUpcomingReportDatesInput;
        const invalidFields = DATE_FIELDS.filter(
          (field) => input[field] !== null && !Validators.isValidDate(input[field]).valid,
        );
        if (invalidFields.length > 0) {
          throw new BadRequestError(MODULE_NAME, {
            message: `Invalid ISO date in field(s): ${invalidFields.join(', ')}`,
          });
        }
        await useCase.upsertUpcomingReportDates(
          trusteeId,
          appointmentId,
          input,
          context.session.user,
        );
        return httpSuccess({ statusCode: HttpStatusCodes.OK });
      }

      const result = await useCase.getUpcomingReportDates(appointmentId);

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
