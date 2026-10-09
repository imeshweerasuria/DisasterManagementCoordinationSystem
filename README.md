# Disaster Management Coordination System

**SE3070 — Assignment 02**

A web-based disaster management system designed to support hazard reporting, disaster event coordination, emergency response operations, and disaster analytics.

---

## Overview

The Disaster Management Coordination System aims to improve coordination and information management during disaster situations. It provides a centralized platform for reporting hazards, managing warnings, coordinating emergency responses, and generating reports that help stakeholders understand disaster-related activities.

The system includes an analytics module that generates reports for completed disaster events, supports PDF and CSV exports, and provides controlled, read-only report sharing.

## Features

### Hazard Reporting
- Submit hazard reports through the web interface.
- Support the hazard-reporting workflow.

### Hazard Warning Management
- Manage hazard warnings and their lifecycle.
- Support warning statuses, severity levels, target zones, and notification channels.

### Disaster Event Management
- Manage disaster event information.
- Retrieve completed events for analytics reporting.

### Emergency Response Coordination
- Access emergency response operations through a dedicated interface.
- Support disaster response coordination workflows.

### Disaster Analytics and Reporting
- Generate analytics reports for completed disaster events and selected date ranges.
- **Alert Reach Audit:** Review alert delivery and recipient reach metrics.
- **Shelter Occupancy Trend:** Analyze shelter occupancy records when data is available.
- **Resource Usage Summary:** Review resource distribution and usage when data is available.
- Export reports as PDF and CSV files.
- Save generated reports for later retrieval.
- Share reports with designated recipients using read-only access.
- Revoke report-sharing permissions.
- Prevent duplicate active shares and unauthorized access to shared reports.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| API communication | REST API |
| Testing | Jest and Supertest |
| Version control | Git and GitHub |

## Project Structure

```text
DisasterManagementCoordinationSystem/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   └── app.js
│   ├── tests/
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   └── src/
│       ├── pages/
│       ├── services/
│       ├── styles/
│       └── App.jsx
└── README.md
```

## Getting Started

Follow these steps to run the project locally.

### Prerequisites

Install the following tools:

- [Node.js and npm](https://nodejs.org/)
- [MongoDB Community Server](https://www.mongodb.com/try/download/community)
- [Git](https://git-scm.com/)

### 1. Clone the Repository

```bash
git clone https://github.com/imeshweerasuria/DisasterManagementCoordinationSystem.git
cd DisasterManagementCoordinationSystem
```

### 2. Configure the Backend

```bash
cd backend
npm install
```

Configure the environment variables required by the backend in a `.env` file. Use the variable names expected by the backend configuration.

Example configuration:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/disaster_management_db
```

These are example values. Confirm the expected environment variable names in the backend source code before using them.

Start the backend using the development script, if available:

```bash
npm run dev
```

The backend is expected to be available at `http://localhost:5000`.

### 3. Configure the Frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL displayed by Vite in the terminal. The development server commonly uses `http://localhost:5173`.

### 4. Open the Analytics Page

Once the frontend and backend are running, navigate to:

`http://localhost:5173/analytics`

Make sure MongoDB is running and the backend is connected to the database.

## API Endpoints

The backend exposes REST API endpoints for the system's main features.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/analytics/events` | Retrieve completed events |
| POST | `/api/analytics/reports` | Generate an analytics report |
| GET | `/api/analytics/reports/:reportId` | Retrieve a saved report |
| GET | `/api/analytics/reports/:reportId/export/csv` | Export a report as CSV |
| GET | `/api/analytics/reports/:reportId/export/pdf` | Export a report as PDF |
| POST | `/api/analytics/reports/:reportId/share` | Share a report |
| DELETE | `/api/analytics/reports/:reportId/share/:recipientId` | Revoke sharing access |
| GET | `/api/analytics/shared/:recipientId/:reportId` | Retrieve a shared report |

Refer to the backend route definitions for request bodies, response formats, and other supported operations.

## Testing

Run the backend test suite:

```bash
cd backend
npm test
```

During development, the backend regression suite passed **114 tests across 4 test suites**.

To verify the frontend build:

```bash
cd frontend
npm run build
```

## Report Sharing and Access Control

The analytics module supports controlled sharing of generated reports.

- Reports can be shared with designated recipients.
- Shared reports are intended for read-only viewing.
- Duplicate active shares are rejected.
- Recipients without an active share are denied access.
- Revoking a share prevents further access through the shared-report endpoint.

Recipient identifiers used during development, such as `EXEC-001`, `DONOR-001`, and `AGENCY-001`, are demonstration identifiers. They should not be treated as proof of production-grade authentication or identity verification.

## Current Verification Status

- [x] Analytics report generation
- [x] PDF and CSV export
- [x] Saved report retrieval
- [x] Read-only report sharing workflow
- [x] Duplicate-share rejection
- [x] Unauthorized shared-report access denial
- [x] Share revocation
- [x] Backend regression tests

**Further testing:** Shelter occupancy and resource usage reports require verification with populated shelter occupancy and relief distribution data.

## Contributors

This project is developed as part of **SE3070 — Assignment 02**.

Contributions and improvements should follow the team's agreed Git workflow and review process.

## License

Developed for academic purposes as part of the SE3070 assignment. Add a formal license if one is required by the project team.

---

**Disaster Management Coordination System**  
*Supporting coordinated disaster response through information and analytics.*