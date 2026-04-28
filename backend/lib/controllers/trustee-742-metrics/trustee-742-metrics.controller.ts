import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsTimerController } from '../controller';
import { finalizeDeferrable } from '../../deferrable/finalize-deferrable';
import {
  Trustee742Metrics,
  Trustee742MetricsUseCase,
} from '../../use-cases/dataflows/trustee-742-metrics';

const MODULE_NAME = 'TRUSTEE-742-METRICS-CONTROLLER';

export class Trustee742MetricsController implements CamsTimerController<Trustee742Metrics> {
  private readonly useCase: Trustee742MetricsUseCase;

  constructor() {
    this.useCase = new Trustee742MetricsUseCase();
  }

  public async handleTimer(context: ApplicationContext): Promise<Trustee742Metrics> {
    try {
      return await this.useCase.gatherMetrics(context);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME);
    } finally {
      await finalizeDeferrable(context);
    }
  }
}
