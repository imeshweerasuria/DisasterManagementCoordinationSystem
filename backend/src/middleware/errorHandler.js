function errorHandler(
  error,
  req,
  res,
  next
) {
  console.error(
    error
  );

  if (
    error?.code ===
    11000
  ) {
    return res
      .status(409)
      .json({
        success: false,
        message:
          'A duplicate record already exists.',
      });
  }

  const statusCode =
    error.statusCode ||
    500;

  return res
    .status(statusCode)
    .json({
      success: false,
      message:
        error.message ||
        'Internal server error.',
    });
}

module.exports = errorHandler;