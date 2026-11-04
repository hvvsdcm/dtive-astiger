import { isRouteErrorResponse } from 'react-router';

export function isNotFound(error: unknown): boolean {
  return isRouteErrorResponse(error) && error.status === 404;
}
