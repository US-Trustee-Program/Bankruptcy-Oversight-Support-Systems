export const HttpStatusCodes = {
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  CREATED: 201,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
  NO_CONTENT: 204,
  NOT_FOUND: 404,
  OK: 200,
  UNAUTHORIZED: 401,
} as const;

export default HttpStatusCodes;
