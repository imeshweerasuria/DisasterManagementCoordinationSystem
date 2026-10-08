import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom';

import HomePage
  from './pages/HomePage';

import HazardReportPage
  from './pages/HazardReportPage';

import PendingReportsPage
  from './pages/PendingReportsPage';

import WarningManagementPage
  from './pages/WarningManagementPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <HomePage />
          }
        />

        <Route
          path="/report-hazard"
          element={
            <HazardReportPage />
          }
        />

        <Route
          path="/duty-officer/reports"
          element={
            <PendingReportsPage />
          }
        />

        <Route
          path="/duty-officer/warnings"
          element={
            <WarningManagementPage />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;