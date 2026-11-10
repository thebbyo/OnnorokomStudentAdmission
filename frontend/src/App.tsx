import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ConnectionBanner } from './components/ConnectionBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { AdminPage } from './pages/AdminPage';
import { ClassListPage } from './pages/ClassListPage';
import { HoldPage } from './pages/HoldPage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { StudentProvider } from './state/StudentContext';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ClassListPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/holds/:holdId" element={<HoldPage />} />
      <Route path="/me" element={<MyApplicationsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <StudentProvider>
        <BrowserRouter>
          <Layout banner={<ConnectionBanner />}>
            <AppRoutes />
          </Layout>
        </BrowserRouter>
      </StudentProvider>
    </ErrorBoundary>
  );
}
