/**
 * Mirrors CamsError's (backend/lib/common-errors/cams-error.ts) serializable shape without
 * importing it — common cannot depend on backend (the Dependency Rule runs the other way: both
 * backend and user-interface depend on common, never the reverse). A real CamsError/UnknownError
 * instance is structurally assignable here, so backend can write one directly.
 */
export type SerializedCamsError = {
  message: string;
  module: string;
  status: number;
  originalError?: string;
  data?: object;
};
