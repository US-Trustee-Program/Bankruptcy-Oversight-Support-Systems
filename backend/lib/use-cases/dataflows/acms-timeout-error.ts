/** True for the MSSQL/ACMS timeout errors that the sync treats as transient (retried by the next invocation). */
export function isAcmsTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message.includes('Timeout') || error.message.includes('RequestError');
}
