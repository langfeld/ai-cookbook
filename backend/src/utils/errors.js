/**
 * ============================================
 * Fehlerbehandlung
 * ============================================
 * Standardisierte Fehlerklassen für die API
 */

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Ressource') {
    super(`${resource} nicht gefunden`, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Ungültige Eingabe') {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

export class AuthError extends AppError {
  constructor(message = 'Nicht autorisiert') {
    super(message, 401);
    this.name = 'AuthError';
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Konflikt') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}
