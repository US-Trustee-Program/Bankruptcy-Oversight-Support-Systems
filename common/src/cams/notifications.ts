export type RoutingCategory = 'profile' | 'zoom-341';

export type NotificationRecipient = {
  /** Routing key, e.g. 'chapter:7', 'chapter:11-subchapter-v', 'category:zoom-341', 'default'. */
  key: string;
  /** Email address. */
  recipientAddress: string;
  /** Optional display name for the To: header. */
  displayName?: string;
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
  primaryChapter?: '7' | '11' | '11-subchapter-v' | '12' | '13';
  /** When set, overrides the default subject line. Used by appointment notifications. */
  subjectOverride?: string;
};
