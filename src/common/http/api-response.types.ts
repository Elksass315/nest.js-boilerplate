interface ApiResponseMeta {
  requestId: string;
  correlationId: string;
  timestamp: string;
}

export interface ApiSuccessResponse<T> {
  success: true;
  meta: ApiResponseMeta;
  data: T;
}
