const express =
  require('express');

const cors =
  require('cors');

const hazardReportRoutes =
  require(
    './routes/hazardReportRoutes'
  );

const errorHandler =
  require(
    './middleware/errorHandler'
  );

const app =
  express();

app.use(
  cors({
    origin:
      process.env.FRONTEND_URL ||
      'http://localhost:5173',

    credentials: true,
  })
);

app.use(
  express.json({
    limit: '10mb',
  })
);

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      success: true,
      message:
        'Disaster Management API is running.',
    });
  }
);

app.use(
  '/api/hazard-reports',
  hazardReportRoutes
);

app.use(
  errorHandler
);

module.exports = app;