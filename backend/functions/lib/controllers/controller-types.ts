interface CamsSuccessResponse<T> {
  success: true;
  body: T;
}

interface CamsErrorResponse {
  success: false;
  message: string;
  errors: Array<string>;
}

export type CamsResponse<T> = CamsSuccessResponse<T> | CamsErrorResponse;
