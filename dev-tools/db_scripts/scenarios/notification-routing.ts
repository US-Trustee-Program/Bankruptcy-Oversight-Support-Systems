/**
 * Scenario: notification-routing
 * Database: cams only
 *
 * Seeds the NOTIFICATION_ROUTING collection used by
 * TrusteeChangeNotificationUseCase to resolve email recipients.
 *
 * Slice 1: chapter:7 and default.
 * Slice 2: chapter:11, chapter:11-subchapter-v, chapter:12, chapter:13,
 *           and category:zoom-341.
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
          id: 'notification-routing-chapter-11',
          key: 'chapter:11',
          recipientAddress: 'ch11-oversight@example.test',
          displayName: 'CH11 Oversight Office',
        },
        {
          id: 'notification-routing-chapter-11-subchapter-v',
          key: 'chapter:11-subchapter-v',
          recipientAddress: 'subv@example.test',
          displayName: 'Sub-V Oversight (Debbie)',
        },
        {
          id: 'notification-routing-chapter-12',
          key: 'chapter:12',
          recipientAddress: 'ch12-oversight@example.test',
          displayName: 'CH12 Oversight Office',
        },
        {
          id: 'notification-routing-chapter-13',
          key: 'chapter:13',
          recipientAddress: 'ch13-oversight@example.test',
          displayName: 'CH13 Oversight Office',
        },
        {
          id: 'notification-routing-category-zoom-341',
          key: 'category:zoom-341',
          recipientAddress: 'ustp-help@example.test',
          displayName: 'USTP Help',
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
