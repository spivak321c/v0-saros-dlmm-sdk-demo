/**
 * Custom error classes for Saros DLMM server
 */

export class SarosError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'SarosError';
  }
}

export class PositionNotFoundError extends SarosError {
  constructor(positionKey: string) {
    super(
      `Position not found: ${positionKey}`,
      'POSITION_NOT_FOUND',
      { positionKey }
    );
    this.name = 'PositionNotFoundError';
  }
}

export class PoolNotFoundError extends SarosError {
  constructor(poolKey: string) {
    super(
      `Pool not found: ${poolKey}`,
      'POOL_NOT_FOUND',
      { poolKey }
    );
    this.name = 'PoolNotFoundError';
  }
}

export class InsufficientDataError extends SarosError {
  constructor(required: number, actual: number) {
    super(
      `Insufficient data points: required ${required}, got ${actual}`,
      'INSUFFICIENT_DATA',
      { required, actual }
    );
    this.name = 'InsufficientDataError';
  }
}

export class RebalanceError extends SarosError {
  constructor(message: string, details?: any) {
    super(message, 'REBALANCE_ERROR', details);
    this.name = 'RebalanceError';
  }
}

export class ValidationError extends SarosError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class RpcError extends SarosError {
  constructor(message: string, details?: any) {
    super(message, 'RPC_ERROR', details);
    this.name = 'RpcError';
  }
}
