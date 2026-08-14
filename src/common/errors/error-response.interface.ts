export interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string | string[];
  timestamp: string;
  path: string;
  requestId: string;
  details?: unknown;
}
