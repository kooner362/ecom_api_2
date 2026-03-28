export class AppError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function badRequest(message: string, code = "BAD_REQUEST") {
  return new AppError(400, code, message);
}

export function unauthorized(message = "Authentication required", code = "UNAUTHORIZED") {
  return new AppError(401, code, message);
}

export function forbidden(message = "Forbidden", code = "FORBIDDEN") {
  return new AppError(403, code, message);
}
