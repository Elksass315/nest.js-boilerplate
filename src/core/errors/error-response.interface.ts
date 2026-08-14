export interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  timestamp: string;
  path: string;
  requestId: string;
  correlationId: string;
  details?: unknown;
}
