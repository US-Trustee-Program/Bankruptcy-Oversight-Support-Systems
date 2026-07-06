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
          id: 'chapter-7-oversight',
          covers: ['chapter:7'],
          recipientAddresses: ['chapter-7-oversight@example.test'],
          displayName: 'Chapter 7 Oversight',
          documentType: 'NOTIFICATION_ROUTING',
        },
        {
          id: 'chapter-11-oversight',
          covers: ['chapter:11'],
          recipientAddresses: ['chapter-11-oversight@example.test'],
          displayName: 'Chapter 11 Oversight',
          documentType: 'NOTIFICATION_ROUTING',
        },
        {
          id: 'chapter-12-oversight',
          covers: ['chapter:12'],
          recipientAddresses: ['chapter-12-oversight@example.test'],
          displayName: 'Chapter 12 Oversight',
          documentType: 'NOTIFICATION_ROUTING',
        },
        {
          id: 'chapter-13-oversight',
          covers: ['chapter:13'],
          recipientAddresses: ['chapter-13-oversight@example.test'],
          displayName: 'Chapter 13 Oversight',
          documentType: 'NOTIFICATION_ROUTING',
        },
        {
          id: 'subchapter-v-oversight',
          covers: ['chapter:11-subchapter-v'],
          recipientAddresses: ['subv@example.test'],
          displayName: 'Chapter 11 Subchapter V',
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
