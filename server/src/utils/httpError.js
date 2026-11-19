function httpError(status, message, errors) {
  const error = new Error(message);
  error.status = status;
  if (errors) error.errors = errors;
  return error;
}

module.exports = httpError;