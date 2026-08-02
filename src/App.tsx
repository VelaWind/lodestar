import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { AboutPage } from '@/pages/AboutPage';
import { ModuleListPage } from '@/pages/ModuleListPage';
import { ModulePage } from '@/pages/ModulePage';

/**
 * Three routes, and depth is not one of them. Depth is a global setting rather
 * than a URL — the same link should read correctly for anyone regardless of the
 * tier they've chosen.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<ModuleListPage />} />
          <Route path="/m/:id" element={<ModulePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
