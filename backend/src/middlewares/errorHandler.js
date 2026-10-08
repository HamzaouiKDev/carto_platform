import { logger } from '../config/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error('Unhandled Application Error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred on the server',
    code: err.code || 'INTERNAL_ERROR',
    ...(isProd ? {} : { stack: err.stack }),
  });
}
