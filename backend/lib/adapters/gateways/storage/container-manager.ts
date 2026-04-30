/**
 * Container Manager
 *
 * Handles automatic creation of blob storage containers at function app startup.
 * Ensures containers exist before dataflows attempt to use them.
 */

import { BlobServiceClient } from '@azure/storage-blob';
import { LoggerImpl } from '../../services/logger.service';

const logger = new LoggerImpl('container-manager');

/**
 * Cache of containers that have been verified to exist.
 * Prevents redundant existence checks during function app lifetime.
 */
const verifiedContainers = new Set<string>();

/**
 * ensureContainersExistAsync
 *
 * Asynchronously ensures blob storage containers exist, creating them if necessary.
 * This function is idempotent and safe to call multiple times.
 *
 * Container creation is logged but does not throw errors - failures are logged
 * and containers will be retried on next access via ObjectStorageGateway.
 *
 * @param containerNames - Array of container names to ensure exist
 * @param moduleName - Module name for logging context
 */
export async function ensureContainersExistAsync(
  containerNames: string[],
  moduleName: string,
): Promise<void> {
  const connectionString = process.env.AzureWebJobsDataflowsStorage;

  if (!connectionString) {
    logger.warn(
      moduleName,
      'AzureWebJobsDataflowsStorage not configured, skipping container creation',
    );
    return;
  }

  // Filter out containers we've already verified
  const containersToCheck = containerNames.filter((name) => !verifiedContainers.has(name));

  if (containersToCheck.length === 0) {
    return; // All containers already verified
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

    for (const containerName of containersToCheck) {
      try {
        const containerClient = blobServiceClient.getContainerClient(containerName);

        // Check if container exists
        const exists = await containerClient.exists();

        if (!exists) {
          // Create container with default settings
          await containerClient.create({
            access: 'none', // Private access (no public access)
          });
          logger.info(moduleName, `Created blob storage container: ${containerName}`);
        } else {
          logger.debug(moduleName, `Blob storage container already exists: ${containerName}`);
        }

        // Mark as verified
        verifiedContainers.add(containerName);
      } catch (containerError) {
        // Log error but continue with other containers
        logger.error(
          moduleName,
          `Failed to ensure container exists: ${containerName}`,
          containerError,
        );
      }
    }
  } catch (error) {
    logger.error(moduleName, 'Failed to connect to blob storage for container creation', error);
  }
}
