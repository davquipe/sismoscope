import { isAbortError, isAppError, isRecoverableAppError } from '@/shared/errors/app-error';

export function isRecoverableError(error: unknown): boolean {
  if (isAbortError(error)) return false;
  return isAppError(error) && isRecoverableAppError(error);
}
