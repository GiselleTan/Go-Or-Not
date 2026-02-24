export interface ApiResponse<T = unknown> {
  statusCode: number;
  body: T;
}

export interface ErrorResponse {
  message: string;
  error?: string;
}
