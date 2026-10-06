function errorHandler(
  error,
  req,
  res,
  next
) {
  console.error(error);

  if (
    error.code === 11000
  ) {
    return res.status(409).json({
      success: false,
      message:
        'Duplicate value detected.',
    });
  }

  res.status(500).json({
    success: false,
    message:
      'An unexpected server error occurred.',
  });
}

module.exports =
  errorHandler;