import { Navigate, Route, Routes } from "react-router-dom";
import "./App.css";
import { AppShell } from "./components/AppShell";
import { ProtectedLayout } from "./components/ProtectedLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { WalkinsAnalyticsPage } from "./pages/analytics/WalkinsAnalyticsPage";
import { CrowdGatheringPage } from "./pages/analytics/CrowdGatheringPage";
import { AfterHoursPage } from "./pages/analytics/AfterHoursPage";
import { StaffPage } from "./pages/StaffPage";
import { ReportsPage } from "./pages/ReportsPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { ActiveAlertsPage } from "./pages/ActiveAlertsPage";
import { LiveViewPage } from "./pages/LiveViewPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { KnownFacesPage } from "./pages/KnownFacesPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { PermissionsProvider, RequirePage } from "./lib/permissions";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PermissionsProvider><ProtectedLayout /></PermissionsProvider>}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={
            <RequirePage page="meghavi_dashboard" label="Dashboard">
              <DashboardPage />
            </RequirePage>
          } />

          {/* Analytics */}
          <Route path="/analytics/walk-ins" element={
            <RequirePage page="meghavi_walkins" label="Walk-ins Analytics">
              <WalkinsAnalyticsPage />
            </RequirePage>
          } />
          <Route path="/analytics/crowd-gathering" element={
            <RequirePage page="monitoring_loitering" label="Crowd Gathering">
              <CrowdGatheringPage />
            </RequirePage>
          } />
          <Route path="/analytics/after-hours" element={
            <RequirePage page="monitoring_after_hours" label="After Hours">
              <AfterHoursPage />
            </RequirePage>
          } />

          {/* Legacy redirect */}
          <Route path="/monitoring/walkins" element={<Navigate to="/analytics/walk-ins" replace />} />

          {/* Operations */}
          <Route path="/live" element={
            <RequirePage page="meghavi_cameras" label="Live View">
              <LiveViewPage />
            </RequirePage>
          } />
          <Route path="/live-view" element={<Navigate to="/live" replace />} />
          <Route path="/cameras" element={<Navigate to="/live" replace />} />

          <Route path="/alerts" element={
            <RequirePage page="meghavi_alerts" label="Active Alerts">
              <ActiveAlertsPage />
            </RequirePage>
          } />
          <Route path="/crowds-report" element={<Navigate to="/alerts" replace />} />

          <Route path="/reports" element={
            <RequirePage page="meghavi_reports" label="Reports">
              <ReportsPage />
            </RequirePage>
          } />

          {/* Administration */}
          <Route path="/audit" element={
            <RequirePage page="audit_logs" label="Audit Logs">
              <AuditLogsPage />
            </RequirePage>
          } />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/settings" element={
            <RequirePage page="settings" label="Settings">
              <SettingsPage />
            </RequirePage>
          } />
          <Route path="/settings/access" element={
            <RequirePage page="access_control" label="Roles & Access">
              <SettingsPage />
            </RequirePage>
          } />

          {/* Additional Features */}
          <Route path="/known-faces" element={
            <RequirePage page="known_faces" label="Known Faces">
              <KnownFacesPage />
            </RequirePage>
          } />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
