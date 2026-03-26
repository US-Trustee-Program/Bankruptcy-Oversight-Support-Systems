import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsTimerController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import {
  TrusteeDueDateMetrics,
  TrusteeDueDateMetricsUseCase,
} from '../../use-cases/dataflows/trustee-due-date-metrics';

const MODULE_NAME = 'TRUSTEE-DUE-DATE-METRICS-CONTROLLER';

export class TrusteeDueDateMetricsController implements CamsTimerController<TrusteeDueDateMetrics> {
  private readonly useCase: TrusteeDueDateMetricsUseCase;

  constructor() {
    this.useCase = new TrusteeDueDateMetricsUseCase();
  }

  public async handleTimer(context: ApplicationContext): Promise<TrusteeDueDateMetrics> {
    try {
      return await this.useCase.gatherMetrics(context);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
