/**
 * Error thrown when raw session data fails validation.
 */
export class SessionValidationError extends Error {
  public readonly errors: string[];

  constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = 'SessionValidationError';
    this.errors = errors.length > 0 ? errors : [message];
    Object.setPrototypeOf(this, SessionValidationError.prototype);
  }
}
