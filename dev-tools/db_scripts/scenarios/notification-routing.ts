/**
 * Scenario: notification-routing
 * Database: cams only
 *
 * Seeds the NOTIFICATION_ROUTING collection used by
 * TrusteeChangeNotificationUseCase to resolve email recipients.
 *
 * Slice 1 seeds two rows: chapter:7 (CH7 oversight mailbox) and default
 * (catch-all). Slice 2 will extend with chapter:11, chapter:11-subchapter-v,
 * chapter:12, chapter:13, and category:zoom-341.
 *
 * Idempotent — re-running against an already-seeded database is a no-op
 * because the runner upserts on the `id` field via mongoUpsert.
 */

import type { SeedContext, SeedOperation } from '../../runner.js';

export async function generate(_ctx: SeedContext): Promise<SeedOperation[]> {
  return [
    {
      db: 'cams',
      collectionOrTable: 'notification-routing',
      data: [
        {
          id: 'notification-routing-chapter-7',
          key: 'chapter:7',
          recipientAddress: 'ch7-oversight@example.test',
          displayName: 'CH7 Oversight Office',
        },
        {
          id: 'notification-routing-default',
          key: 'default',
          recipientAddress: 'default-oversight@example.test',
          displayName: 'Default Oversight Office',
        },
      ],
    },
  ];
}
