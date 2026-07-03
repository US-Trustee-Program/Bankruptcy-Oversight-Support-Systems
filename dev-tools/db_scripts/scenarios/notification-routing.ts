/**
 * Scenario: notification-routing
 * Database: cams only
 *
 * Seeds the NOTIFICATION_ROUTING collection used by
 * TrusteeChangeNotificationUseCase to resolve email recipients.
 *
 * 3 fixed recipient records, each with a covers array listing
 * which routing keys it handles.
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
          id: 'default-chapter-oversight',
          covers: ['chapter:7', 'chapter:11', 'chapter:12', 'chapter:13'],
          recipientAddresses: ['chapter-oversight@example.test'],
          displayName: 'Default Chapter Oversight',
          documentType: 'NOTIFICATION_ROUTING',
        },
        {
          id: 'subchapter-v-oversight',
          covers: ['chapter:11-subchapter-v'],
          recipientAddresses: ['subv@example.test'],
          displayName: 'Subchapter V Oversight',
          documentType: 'NOTIFICATION_ROUTING',
        },
        {
          id: '341-meeting-oversight',
          covers: ['category:zoom-341'],
          recipientAddresses: ['zoom-341@example.test'],
          displayName: '341 Meeting Oversight',
          documentType: 'NOTIFICATION_ROUTING',
        },
      ],
    },
  ];
}
