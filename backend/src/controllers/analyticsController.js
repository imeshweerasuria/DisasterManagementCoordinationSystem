
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');

const analyticsService = require('../services/analyticsService');
const AnalyticsReport = require('../models/AnalyticsReport');
const AnalyticsShare = require('../models/AnalyticsShare');

const ALLOWED_RECIPIENTS = ['EXEC-001', 'DONOR-001', 'AGENCY-001'];

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateId(id, label = 'Report ID') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createError(`Invalid ${label}.`, 400);
  }
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function toPlainValue(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('hex');

  if (
    typeof value === 'object' &&
    (value._bsontype === 'ObjectId' ||
      value.constructor?.name === 'ObjectId')
  ) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toPlainValue);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        toPlainValue(child),
      ])
    );
  }

  return value;
}

function escapeCsv(value) {
  if (value === null || value === undefined) return '""';

  const text =
    typeof value === 'object'
      ? JSON.stringify(toPlainValue(value))
      : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function flattenMetrics(metrics, prefix = '') {
  const rows = [];

  if (!metrics || typeof metrics !== 'object') return rows;

  for (const [key, originalValue] of Object.entries(metrics)) {
    const value = toPlainValue(originalValue);
    const path = prefix ? `${prefix}.${key}` : key;

    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      rows.push(...flattenMetrics(value, path));
    } else if (Array.isArray(value)) {
      rows.push([path, JSON.stringify(value)]);
    } else {
      rows.push([path, value]);
    }
  }

  return rows;
}

function formatLabel(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPdfValue(value, key = '') {
  if (value === null || value === undefined || value === '') return '—';
  if (Buffer.isBuffer(value)) return value.toString('hex');

  if (
    typeof value === 'object' &&
    (value._bsontype === 'ObjectId' ||
      value.constructor?.name === 'ObjectId')
  ) {
    return value.toString();
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (Array.isArray(value)) {
    return value.length
      ? value.map((item) => formatPdfValue(item)).join(', ')
      : '—';
  }

  if (value instanceof Date) return value.toLocaleString();

  if (typeof value === 'object') {
    if (value.type === 'DISTRICT' && value.name) {
      return `${value.name} District`;
    }

    return Object.entries(value)
      .map(
        ([childKey, child]) =>
          `${formatLabel(childKey)}: ${formatPdfValue(child)}`
      )
      .join(' | ');
  }

  if (key.toLowerCase().includes('percentage')) {
    return `${value}%`;
  }

  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value)
  ) {
    return new Date(value).toLocaleString();
  }

  return String(value);
}

const listCompletedEvents = asyncHandler(async (req, res) => {
  const events = await analyticsService.listCompletedEvents();
  res.status(200).json({ success: true, data: events });
});

const generateReport = asyncHandler(async (req, res) => {
  const report = await analyticsService.generateReport(
    req.body,
    req.body.generatedBy || 'EXEC-001'
  );

  res.status(201).json({
    success: true,
    message: 'Analytics report generated successfully.',
    data: report,
  });
});

const getReport = asyncHandler(async (req, res) => {
  validateId(req.params.reportId);

  const report = await AnalyticsReport.findById(req.params.reportId)
    .populate('eventId', 'eventCode name district hazardType startDate endDate');

  if (!report) {
    throw createError('Analytics report not found.', 404);
  }

  res.status(200).json({ success: true, data: report });
});

/* =========================================================
   CSV EXPORT
   ========================================================= */

const exportCsv = asyncHandler(async (req, res) => {
  validateId(req.params.reportId);

  const report = await AnalyticsReport.findById(req.params.reportId)
    .populate('eventId', 'eventCode name district')
    .lean();

  if (!report) {
    throw createError('Analytics report not found.', 404);
  }

  const event = report.eventId;
  const rows = [
    ['DISASTER ANALYTICS REPORT'],
    ['Report Type', report.reportType],
    ['Report ID', report._id],
    ['Event', event?.name || event?._id || report.eventId],
    ['Event Code', event?.eventCode || ''],
    ['District', report.filters?.district || event?.district || 'All'],
    ['Generated At', report.generatedAt],
    ['Generated By', report.generatedBy],
    ['Start Date', report.filters?.startDate],
    ['End Date', report.filters?.endDate],
    [],
    ['SUMMARY METRICS'],
    ['Metric', 'Value'],
  ];

  const metrics = report.metrics || {};
  const sectionKeys = new Set([
    'channelSummary',
    'warnings',
    'occupancyOverTime',
    'distributions',
  ]);

  for (const [key, value] of Object.entries(metrics)) {
    if (sectionKeys.has(key)) continue;

    if (Array.isArray(value)) continue;

    if (value && typeof value === 'object' && !(value instanceof Date)) {
      for (const [childKey, childValue] of Object.entries(value)) {
        if (Array.isArray(childValue)) continue;
        rows.push([
          `${formatLabel(key)} - ${formatLabel(childKey)}`,
          formatPdfValue(childValue, childKey),
        ]);
      }
    } else {
      rows.push([formatLabel(key), formatPdfValue(value, key)]);
    }
  }

  const addTableSection = (key, title) => {
    const data = metrics[key];

    if (!Array.isArray(data)) return;

    rows.push([], [title]);

    if (!data.length) {
      rows.push(['No records available']);
      return;
    }

    const objects = data.filter(
      (item) => item && typeof item === 'object' && !Array.isArray(item)
    );

    if (!objects.length) {
      rows.push(['Value']);
      data.forEach((item) => rows.push([formatPdfValue(item)]));
      return;
    }

    const columns = [
      ...new Set(objects.flatMap((item) => Object.keys(item))),
    ];

    rows.push(columns.map(formatLabel));

    data.forEach((item) => {
      const record =
        item && typeof item === 'object' && !Array.isArray(item)
          ? item
          : { value: item };

      rows.push(
        columns.map((column) => formatPdfValue(record[column], column))
      );
    });
  };

  addTableSection('channelSummary', 'CHANNEL SUMMARY');
  addTableSection('warnings', 'WARNINGS');
  addTableSection('occupancyOverTime', 'OCCUPANCY OVER TIME');
  addTableSection('distributions', 'RESOURCE DISTRIBUTIONS');

  const csv = rows
    .map((row) => row.map(escapeCsv).join(','))
    .join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="analytics-${report.reportType.toLowerCase()}-${report._id}.csv"`
  );

  res.status(200).send(`\uFEFF${csv}`);
});

/* =========================================================
   PDF EXPORT
   ========================================================= */

const exportPdf = asyncHandler(async (req, res) => {
  validateId(req.params.reportId);

  const report = await AnalyticsReport.findById(req.params.reportId)
    .populate('eventId', 'eventCode name district');

  if (!report) {
    throw createError('Analytics report not found.', 404);
  }

  const reportTitles = {
    ALERT_REACH_AUDIT: 'Alert Reach Audit',
    SHELTER_OCCUPANCY_TREND: 'Shelter Occupancy Trend',
    RESOURCE_USAGE_SUMMARY: 'Resource Usage Summary',
  };

  const event = report.eventId;
  const eventName = event?.name || event?._id || report.eventId;
  const metrics = toPlainValue(report.metrics || {});
  const startDate = new Date(report.filters.startDate).toLocaleDateString();
  const endDate = new Date(report.filters.endDate).toLocaleDateString();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="analytics-${report.reportType.toLowerCase()}-${report._id}.pdf"`
  );

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 52, left: 48, right: 48 },
    bufferPages: true,
    autoFirstPage: true,
  });

  let streamFailed = false;

  doc.on('error', (error) => {
    streamFailed = true;
    console.error('Analytics PDF generation failed:', error.message);

    if (!res.headersSent && !res.destroyed) {
      res.status(500).end('Failed to export the PDF report.');
    } else if (!res.destroyed) {
      res.destroy(error);
    }
  });

  res.on('error', (error) => {
    console.error('Analytics PDF response failed:', error.message);
  });

  doc.pipe(res);

  const availableWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const ensureSpace = (height = 40) => {
    if (
      doc.y + height >
      doc.page.height - doc.page.margins.bottom
    ) {
      doc.addPage();
    }
  };

  const sectionHeading = (heading) => {
    ensureSpace(38);
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#145f50');
    doc.text(heading);
    doc.moveDown(0.35);
    doc.fillColor('#263842');
  };

  const drawTable = (columns, data) => {
    if (!data.length) {
      ensureSpace(24);
      doc.font('Helvetica').fontSize(9).text('No records available.');
      return;
    }

    const padding = 6;
    const columnWidth = availableWidth / columns.length;

    const drawRow = (values, isHeader = false) => {
      const font = isHeader ? 'Helvetica-Bold' : 'Helvetica';
      const fontSize = isHeader ? 8 : 8.5;

      doc.font(font).fontSize(fontSize);

      const cellHeights = values.map((value) =>
        doc.heightOfString(String(value ?? '—'), {
          width: Math.max(20, columnWidth - padding * 2),
          lineGap: 1,
        })
      );

      const rowHeight = Math.max(25, Math.max(...cellHeights) + padding * 2);
      ensureSpace(rowHeight + 2);

      const top = doc.y;
      const left = doc.page.margins.left;

      if (isHeader) {
        doc.save();
        doc.rect(left, top, availableWidth, rowHeight).fill('#eaf4f1');
        doc.restore();
      }

      values.forEach((value, index) => {
        const x = left + index * columnWidth;

        doc.font(font).fontSize(fontSize);
        doc.fillColor(isHeader ? '#145f50' : '#263842');

        doc.text(String(value ?? '—'), x + padding, top + padding, {
          width: columnWidth - padding * 2,
          height: rowHeight - padding,
          lineGap: 1,
          ellipsis: false,
        });
      });

      doc.save();
      doc.strokeColor('#dce5e7').lineWidth(0.5);
      doc
        .moveTo(left, top + rowHeight)
        .lineTo(left + availableWidth, top + rowHeight)
        .stroke();
      doc.restore();

      doc.y = top + rowHeight;
    };

    drawRow(columns, true);

    data.forEach((record) => {
      drawRow(
        columns.map((column) => formatPdfValue(record[column], column))
      );
    });

    doc.moveDown(0.3);
  };

  // Header
  doc.font('Helvetica-Bold').fontSize(21).fillColor('#145f50');
  doc.text('DISASTER ANALYTICS REPORT', { align: 'center' });
  doc.moveDown(0.3);

  doc.font('Helvetica-Bold').fontSize(15).fillColor('#263842');
  doc.text(reportTitles[report.reportType] || report.reportType, {
    align: 'center',
  });
  doc.moveDown(1);

  // Report information
  sectionHeading('Report Information');

  const metadata = [
    ['Event', eventName],
    ['Event Code', event?.eventCode || '—'],
    ['District', report.filters?.district || event?.district || 'All'],
    ['Reporting Period', `${startDate} – ${endDate}`],
    ['Report ID', String(report._id)],
    ['Generated At', new Date(report.generatedAt).toLocaleString()],
    ['Generated By', report.generatedBy || '—'],
  ];

  metadata.forEach(([label, value]) => {
    ensureSpace(20);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#263842');
    doc.text(`${label}: `, { continued: true });
    doc.font('Helvetica').text(String(value ?? '—'));
  });

  // Summary metrics: use matching lowercase object keys.
  const summaryMetrics = Object.entries(metrics).filter(
    ([, value]) =>
      value === null ||
      ['string', 'number', 'boolean'].includes(typeof value)
  );

  if (summaryMetrics.length) {
    sectionHeading('Summary Metrics');

    drawTable(
      ['Metric', 'Value'],
      summaryMetrics.map(([key, value]) => ({
        Metric: formatLabel(key),
        Value: formatPdfValue(value, key),
      }))
    );
  }

  // Report-specific tables.
  const tableSections = [
    ['channelSummary', 'Channel Summary'],
    ['warnings', 'Warnings'],
    ['occupancyOverTime', 'Occupancy Over Time'],
    ['distributions', 'Resource Distribution Records'],
  ];

  for (const [key, heading] of tableSections) {
    if (!Array.isArray(metrics[key])) continue;

    sectionHeading(heading);

    const data = metrics[key].map((item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? item
        : { Value: item }
    );

    const columns = data.length
      ? [...new Set(data.flatMap((item) => Object.keys(item)))]
      : ['Value'];

    drawTable(
      columns.map((column) => column),
      data
    );
  }

  // Other nested metrics.
  const handledKeys = new Set(tableSections.map(([key]) => key));

  for (const [key, value] of Object.entries(metrics)) {
    if (
      handledKeys.has(key) ||
      value === null ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      continue;
    }

    sectionHeading(formatLabel(key));

    const data = Object.entries(value).map(([childKey, childValue]) => ({
      Metric: formatLabel(childKey),
      Value: formatPdfValue(childValue, childKey),
    }));

    drawTable(['Metric', 'Value'], data);
  }

  // Add footers only to pages that already exist.
  if (!streamFailed) {
    const pageRange = doc.bufferedPageRange();

    for (
      let index = pageRange.start;
      index < pageRange.start + pageRange.count;
      index += 1
    ) {
      doc.switchToPage(index);

      const footerY = doc.page.height - 34;

      doc.font('Helvetica').fontSize(8).fillColor('#64748b');
      doc.text(
        `Disaster Analytics | ${report._id} | Page ${index + 1} of ${pageRange.count}`,
        doc.page.margins.left,
        footerY,
        {
          width: availableWidth,
          align: 'center',
          lineBreak: false,
        }
      );
    }
  }

  doc.end();
});

/* =========================================================
   READ-ONLY SHARING
   ========================================================= */

const shareReport = asyncHandler(async (req, res) => {
  validateId(req.params.reportId);

  const { recipientId, sharedBy } = req.body;

  if (!ALLOWED_RECIPIENTS.includes(recipientId)) {
    throw createError('Recipient is not authorized for demo sharing.', 403);
  }

  if (!sharedBy || typeof sharedBy !== 'string' || !sharedBy.trim()) {
    throw createError('sharedBy is required.', 400);
  }

  const report = await AnalyticsReport.findById(req.params.reportId);

  if (!report) {
    throw createError('Analytics report not found.', 404);
  }

  let share = await AnalyticsShare.findOne({
    reportId: report._id,
    recipientId,
  });

  if (share && share.isActive) {
    throw createError(
      'This report is already shared with that recipient.',
      409
    );
  }

  if (share) {
    share.permission = 'READ_ONLY';
    share.sharedBy = sharedBy.trim();
    share.isActive = true;
    share.sharedAt = new Date();
    share.revokedAt = null;
    share.auditHistory.push({
      action: 'SHARED',
      actorId: sharedBy.trim(),
      details: 'Read-only report access granted again.',
      occurredAt: new Date(),
    });

    await share.save();
  } else {
    share = await AnalyticsShare.create({
      reportId: report._id,
      recipientId,
      permission: 'READ_ONLY',
      sharedBy: sharedBy.trim(),
      auditHistory: [
        {
          action: 'SHARED',
          actorId: sharedBy.trim(),
          details: 'Read-only report access granted.',
          occurredAt: new Date(),
        },
      ],
    });
  }

  res.status(201).json({
    success: true,
    message: 'Report shared with read-only access.',
    data: share,
  });
});

const getSharedReport = asyncHandler(async (req, res) => {
  validateId(req.params.reportId);

  const { recipientId } = req.params;

  if (!ALLOWED_RECIPIENTS.includes(recipientId)) {
    throw createError('Recipient is not authorized.', 403);
  }

  const share = await AnalyticsShare.findOne({
    reportId: req.params.reportId,
    recipientId,
    isActive: true,
  });

  if (!share) {
    throw createError('No active share found for this recipient.', 403);
  }

  share.auditHistory.push({
    action: 'VIEWED',
    actorId: recipientId,
    details: 'Shared report viewed.',
    occurredAt: new Date(),
  });

  await share.save();

  const report = await AnalyticsReport.findById(req.params.reportId)
    .populate('eventId', 'eventCode name district hazardType startDate endDate');

  if (!report) {
    throw createError('Analytics report not found.', 404);
  }

  res.status(200).json({
    success: true,
    permission: 'READ_ONLY',
    data: report,
  });
});

const revokeShare = asyncHandler(async (req, res) => {
  validateId(req.params.reportId);

  const { recipientId } = req.params;
  const { revokedBy } = req.body;

  if (!ALLOWED_RECIPIENTS.includes(recipientId)) {
    throw createError('Recipient is not authorized.', 403);
  }

  if (!revokedBy || typeof revokedBy !== 'string' || !revokedBy.trim()) {
    throw createError('revokedBy is required.', 400);
  }

  const share = await AnalyticsShare.findOne({
    reportId: req.params.reportId,
    recipientId,
    isActive: true,
  });

  if (!share) {
    throw createError('Active share not found.', 404);
  }

  share.isActive = false;
  share.revokedAt = new Date();
  share.auditHistory.push({
    action: 'REVOKED',
    actorId: revokedBy.trim(),
    details: 'Read-only report access revoked.',
    occurredAt: new Date(),
  });

  await share.save();

  res.status(200).json({
    success: true,
    message: 'Report sharing revoked.',
    data: share,
  });
});

module.exports = {
  listCompletedEvents,
  generateReport,
  getReport,
  exportCsv,
  exportPdf,
  shareReport,
  getSharedReport,
  revokeShare,
};
