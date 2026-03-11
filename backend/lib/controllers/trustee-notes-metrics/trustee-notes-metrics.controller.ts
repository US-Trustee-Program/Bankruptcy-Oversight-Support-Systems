import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsTimerController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import {
  TrusteeNoteMetrics,
  TrusteeNotesMetricsUseCase,
} from '../../use-cases/dataflows/trustee-notes-metrics';

const MODULE_NAME = 'TRUSTEE-NOTES-METRICS-CONTROLLER';

export class TrusteeNotesMetricsController implements CamsTimerController<TrusteeNoteMetrics> {
  private readonly useCase: TrusteeNotesMetricsUseCase;

  constructor() {
    this.useCase = new TrusteeNotesMetricsUseCase();
  }

  public async handleTimer(context: ApplicationContext): Promise<TrusteeNoteMetrics> {
    try {
      return await this.useCase.gatherMetrics(context);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
