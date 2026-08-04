export type AppErrorKind =
  | 'network'
  | 'http'
  | 'validation'
  | 'rate-limit'
  | 'query-too-large'
  | 'persistence'
  | 'unexpected';

abstract class SismoScopeError extends Error {
  abstract readonly kind: AppErrorKind;
  abstract readonly code: string;
  readonly causeValue: unknown;

  protected constructor(message: string, causeValue?: unknown) {
    super(message);
    this.name = new.target.name;
    this.causeValue = causeValue;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NetworkError extends SismoScopeError {
  readonly kind = 'network' as const;
  readonly code: 'NETWORK_FAILURE' | 'REQUEST_TIMEOUT';

  constructor(
    message = 'No se pudo conectar con el servicio de datos.',
    options: { readonly timeout?: boolean; readonly cause?: unknown } = {},
  ) {
    super(message, options.cause);
    this.code = options.timeout === true ? 'REQUEST_TIMEOUT' : 'NETWORK_FAILURE';
  }
}

export class HttpError extends SismoScopeError {
  readonly kind = 'http' as const;
  readonly code = 'HTTP_ERROR' as const;

  constructor(
    readonly status: number,
    readonly url: string,
    message = `El servicio respondió con HTTP ${status}.`,
    causeValue?: unknown,
  ) {
    super(message, causeValue);
  }
}

export class ValidationError extends SismoScopeError {
  readonly kind = 'validation' as const;
  readonly code = 'INVALID_EXTERNAL_DATA' as const;

  constructor(
    message = 'Los datos recibidos no tienen un formato válido.',
    readonly issues: readonly string[] = [],
    causeValue?: unknown,
  ) {
    super(message, causeValue);
  }
}

export class RateLimitError extends SismoScopeError {
  readonly kind = 'rate-limit' as const;
  readonly code = 'RATE_LIMITED' as const;

  constructor(
    readonly retryAfterSeconds: number | null,
    message = 'USGS limitó temporalmente las solicitudes.',
    causeValue?: unknown,
  ) {
    super(message, causeValue);
  }
}

export class QueryTooLargeError extends SismoScopeError {
  readonly kind = 'query-too-large' as const;
  readonly code = 'QUERY_TOO_LARGE' as const;

  constructor(
    readonly eventCount: number,
    readonly maximumAllowed: number,
    message = `La consulta contiene ${eventCount} eventos; el máximo permitido es ${maximumAllowed}.`,
  ) {
    super(message);
  }
}

export class PersistenceError extends SismoScopeError {
  readonly kind = 'persistence' as const;
  readonly code = 'PERSISTENCE_FAILURE' as const;

  constructor(
    message = 'No se pudieron guardar o recuperar los datos locales.',
    causeValue?: unknown,
  ) {
    super(message, causeValue);
  }
}

export class UnexpectedError extends SismoScopeError {
  readonly kind = 'unexpected' as const;
  readonly code = 'UNEXPECTED_ERROR' as const;

  constructor(message = 'Ocurrió un error inesperado.', causeValue?: unknown) {
    super(message, causeValue);
  }
}

export type AppError =
  | NetworkError
  | HttpError
  | ValidationError
  | RateLimitError
  | QueryTooLargeError
  | PersistenceError
  | UnexpectedError;

export function isAppError(error: unknown): error is AppError {
  return error instanceof SismoScopeError;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

export function toUnexpectedError(error: unknown): UnexpectedError {
  if (error instanceof Error) {
    return new UnexpectedError(error.message, error);
  }

  return new UnexpectedError('Ocurrió un error inesperado.', error);
}

export function isRecoverableAppError(error: AppError): boolean {
  return (
    error.kind === 'network' ||
    error.kind === 'rate-limit' ||
    (error.kind === 'http' && error.status >= 500)
  );
}
