import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppShell } from '@/widgets/app-shell/AppShell';

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const ExplorerPage = lazy(() => import('@/pages/explorer/ExplorerPage'));
const EventDetailPage = lazy(() => import('@/pages/event-detail/EventDetailPage'));
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'));
const ComparePage = lazy(() => import('@/pages/compare/ComparePage'));
const SavedPage = lazy(() => import('@/pages/saved/SavedPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const AboutPage = lazy(() => import('@/pages/about/AboutPage'));

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="explorer" element={<ExplorerPage />} />
        <Route path="events/:eventId" element={<EventDetailPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="saved" element={<SavedPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
