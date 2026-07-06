import { AppointmentChapterType } from './trustees';
import { Identifiable } from './document';
import { Auditable } from './auditable';

export type RoutingCategory = 'profile' | 'zoom-341';

export type NotificationRoutingDefinition = {
  id: string;
  covers: string[];
  displayName: string;
};

export const NOTIFICATION_ROUTING_DEFINITIONS: NotificationRoutingDefinition[] = [
  {
    id: 'chapter-7-oversight',
    covers: ['chapter:7'],
    displayName: 'Chapter 7 Oversight',
  },
  {
    id: 'chapter-11-oversight',
    covers: ['chapter:11'],
    displayName: 'Chapter 11 Oversight',
  },
  {
    id: 'chapter-12-oversight',
    covers: ['chapter:12'],
    displayName: 'Chapter 12 Oversight',
  },
  {
    id: 'chapter-13-oversight',
    covers: ['chapter:13'],
    displayName: 'Chapter 13 Oversight',
  },
  {
    id: 'subchapter-v-oversight',
    covers: ['chapter:11-subchapter-v'],
    displayName: 'Chapter 11 Subchapter V',
  },
  {
    id: '341-meeting-oversight',
    covers: ['category:zoom-341'],
    displayName: '341 Meeting Oversight',
  },
];

export type NotificationRecipient = {
  covers: string[];
  recipientAddresses: string[];
  displayName: string;
};

export type NotificationRoutingRecord = Identifiable &
  NotificationRecipient & {
    documentType: 'NOTIFICATION_ROUTING';
  };

export type NotificationRoutingUpdateInput = {
  recipientAddresses: string[];
};

export type NotificationRoutingAuditHistory = Identifiable &
  Auditable & {
    documentType: 'AUDIT_NOTIFICATION_ROUTING';
    routingRecordId: string;
    before: string;
    after: string;
  };

export type NotificationConfig = {
  enabled: boolean;
};

export type Notification = {
  /** Routed recipient address. Required. */
  to: string;
  /** Optional display name to pair with the To: address. */
  toDisplayName?: string;
  /** Subject line. */
  subject: string;
  /** Rendered HTML body. */
  html: string;
  /** Plaintext fallback. Mechanically derived from the same change set. */
  text: string;
  /** Correlation id sourced from ApplicationContext.invocationId. Used by gateway impls + log lines. */
  correlationId: string;
  /** Optional reply-to address (e.g. the user who made the change). */
  replyTo?: { address: string; displayName?: string };
};

export type TrusteeChangeField = {
  /** Display label, e.g. "Public Email", "Zoom Link". */
  label: string;
  /** Previous value. May be empty string for newly-added fields. */
  before: string;
  /** New value. May be empty string for cleared fields. */
  after: string;
  /** Routing category — drives recipient resolution. */
  category: RoutingCategory;
  /** Template grouping. Slice 1 only emits 'appointment' rows for profile fields. */
  section: 'appointment' | 'meeting';
  /** True for fields whose values are comma/semicolon-separated lists that should render stacked. */
  stackValues?: boolean;
};

export type TrusteeChangeSet = {
  trusteeId: string;
  trusteeName: string;
  /** Never empty when emitted — callers MUST short-circuit if no fields changed. */
  fields: TrusteeChangeField[];
  /** Chapter type used for routing. Read from the trustee's primary appointment; undefined when no appointment exists. */
  primaryChapter?: AppointmentChapterType;
  /** When set, overrides the default subject line. Used by appointment notifications. */
  subjectOverride?: string;
  /** The user who made the change. */
  author?: { name: string; email?: string };
  /** ISO 8601 UTC timestamp of when the change was saved. */
  changedAt?: string;
  /** Full URL to the trustee profile page in CAMS. Omitted if frontend URL is not configured. */
  profileLink?: string;
};
