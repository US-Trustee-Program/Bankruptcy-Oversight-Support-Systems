import { ApplicationContext } from '../../types/basic';
import { DataflowsHttpGateway } from '../../../use-cases/gateways.types';

const MODULE_NAME = 'DATAFLOWS-HTTP-GATEWAY';

export class DataflowsHttpGatewayImpl implements DataflowsHttpGateway {
  async queueCaseReload(context: ApplicationContext, caseId: string): Promise<void> {
    const logger = context.logger;
    const dataflowsBaseUrl = context.config.dataflowsBaseUrl;
    const adminKey = context.config.adminKey;

    if (!dataflowsBaseUrl) {
      throw new Error('CAMS_DATAFLOWS_BASE_URL not configured');
    }

    if (!adminKey) {
      throw new Error('ADMIN_KEY not configured');
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`${dataflowsBaseUrl}/sync-cases-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `ApiKey ${adminKey}`,
        },
        body: JSON.stringify({ caseIds: [caseId] }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to queue case reload: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      logger.info(MODULE_NAME, `Successfully queued case reload for: ${caseId}`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(MODULE_NAME, `Timeout queueing case reload for ${caseId}`);
        throw new Error(`Request timeout while queueing case reload for ${caseId}`);
      }
      logger.error(MODULE_NAME, `Error queueing case reload for ${caseId}:`, error);
      throw error;
    }
  }
}
