function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.originalUrl}`,
    error: 'NOT_FOUND',
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.',
    error: err.error || err.name || 'SERVER_ERROR',
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
