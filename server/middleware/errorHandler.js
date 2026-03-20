// Centralized error handler — catches anything passed via next(err)
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Something went wrong. Please try again.'
    : err.message || 'Internal server error';
  res.status(statusCode).json({ error: message });
};

export default errorHandler;
