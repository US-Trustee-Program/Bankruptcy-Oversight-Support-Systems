import { ApplicationContext } from '../../adapters/types/basic';

const MODULE_NAME = 'CASE-RELOAD-USE-CASE';

async function queueCaseReload(context: ApplicationContext, caseId: string): Promise<void> {
  const logger = context.logger;
  const dataflowsBaseUrl = process.env.CAMS_DATAFLOWS_BASE_URL;
  const adminKey = process.env.ADMIN_KEY;

  if (!dataflowsBaseUrl) {
    throw new Error('CAMS_DATAFLOWS_BASE_URL not configured');
  }

  if (!adminKey) {
    throw new Error('ADMIN_KEY not configured');
  }

  try {
    const response = await fetch(`${dataflowsBaseUrl}/sync-cases-page`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `ApiKey ${adminKey}`,
      },
      body: JSON.stringify({ caseIds: [caseId] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to queue case reload: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    logger.info(MODULE_NAME, `Successfully queued case reload for: ${caseId}`);
  } catch (error) {
    logger.error(MODULE_NAME, `Error queueing case reload for ${caseId}:`, error);
    throw error;
  }
}

export default {
  queueCaseReload,
};
