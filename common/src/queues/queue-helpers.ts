/**
 * Shared queue helper functions for Azure Storage Queues
 * Used by both backend dataflows and downstream integration functions
 */

/**
 * buildFunctionName
 *
 * Builds an Azure function name as seen in the Azure Portal that avoids duplicate names
 * by using the MODULE_NAME as a name space.
 *
 * @param parts - Parts to join into function name
 * @returns Function name with underscores and spaces replaced by hyphens
 *
 * @example
 * buildFunctionName('SYNC', 'CASES', 'handler')
 * // Returns: 'SYNC-CASES-handler'
 */
export function buildFunctionName(...parts: string[]): string {
  return parts.join('-').replace(/_/g, '-').replace(' ', '-');
}

/**
 * buildQueueName
 *
 * Builds an Azure storage queue name as seen in the Azure Portal that avoids duplicate names
 * by using the MODULE_NAME as a name space and abides by naming requirements.
 *
 * Azure Storage Queue naming rules:
 * - Must be lowercase
 * - Must be between 3 and 63 characters
 * - Must start with a letter or number
 * - Can contain only letters, numbers, and hyphens
 *
 * @param parts - Parts to join into queue name
 * @returns Lowercase queue name with underscores and spaces replaced by hyphens
 *
 * @example
 * buildQueueName('SYNC-CASES', 'start')
 * // Returns: 'sync-cases-start'
 *
 * @example
 * buildQueueName('MIGRATE_TRUSTEES', 'page')
 * // Returns: 'migrate-trustees-page'
 */
export function buildQueueName(...parts: string[]): string {
  return buildFunctionName(...parts).toLowerCase();
}
