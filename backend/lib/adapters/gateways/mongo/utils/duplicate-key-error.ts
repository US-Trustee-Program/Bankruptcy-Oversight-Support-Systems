/**
 * Cosmos/MongoDB signals a unique-index violation via an "E11000" message; the code property is
 * stripped by MongoCollectionAdapter's error handling, so detection must be message-based. Checks
 * are intentionally broad to guard against driver version variance (same rationale as
 * mongo-adapter.ts's isRateLimitError).
 */
export function isDuplicateKeyError(error: unknown): boolean {
  if (!(error instanceof Object) || !('message' in error)) {
    return false;
  }
  const message = String((error as { message: unknown }).message);
  return message.includes('E11000') || /duplicate key/i.test(message);
}
