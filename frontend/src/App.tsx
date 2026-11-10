import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { NotFoundPage } from './pages/NotFoundPage';
import { StudentProvider } from './state/StudentContext';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<h1>Classes</h1>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export function App() {
  return (
    <StudentProvider>
      <BrowserRouter>
        <Layout>
          <AppRoutes />
        </Layout>
      </BrowserRouter>
    </StudentProvider>
  );
}
