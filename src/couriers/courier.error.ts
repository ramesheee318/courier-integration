export type CourierErrorType =
  | 'CLIENT_ERROR'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR';

export class CourierError extends Error {
  constructor(
    public readonly type: CourierErrorType,
    message: string,
    public readonly statusCode?: number,
    public readonly rawResponse?: unknown,
  ) {
    super(message);
    this.name = 'CourierError';
  }
}
