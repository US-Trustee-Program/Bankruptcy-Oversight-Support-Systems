/**
 * Message-embedded marker that ops/cloud-deployment/main.bicep's acsSendFailureAlert scheduled
 * query greps for in AppTraces. Embed this in the message text of any log line that should page
 * on-call for a notification send failure -- moduleName stays whichever class/file actually
 * emitted the line, so log search can still attribute it correctly. Keep this constant in sync
 * with that KQL if it ever changes.
 */
export const NOTIFICATION_SEND_FAILURE_TAG = '[notification-send-failure]';
