import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { ModuleListPage } from '@/pages/ModuleListPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/**
 * The index is the entry point and stays eager. The other two routes are split
 * off it, and the reason is KaTeX: `RichText` pulls it in, it is a quarter of a
 * megabyte, and a reader who lands on the front page and leaves never needed a
 * single glyph of it. Lighthouse measured 57 kB of unused JavaScript on the
 * landing page before this, which is exactly that.
 */
const ModulePage = lazy(() =>
  import('@/pages/ModulePage').then((m) => ({ default: m.ModulePage })),
);
const AboutPage = lazy(() =>
  import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })),
);

/**
 * Three routes, and depth is not one of them. Depth is a global setting rather
 * than a URL — the same link should read correctly for anyone regardless of the
 * tier they've chosen.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        {/* Empty rather than a spinner: these chunks arrive in tens of
            milliseconds and a flashed loading state costs more than it explains.
            But it reserves a full viewport, and that part is not cosmetic — at
            60vh the footer sat on screen and was shoved down when the route
            arrived, which Lighthouse measured as 0.156 of layout shift on a
            module page. A screenful of placeholder puts it below the fold, so
            nothing visible moves. */}
        <Suspense fallback={<div className="min-h-screen" aria-busy="true" />}>
          <Routes>
            <Route path="/" element={<ModuleListPage />} />
            <Route path="/m/:id" element={<ModulePage />} />
            <Route path="/about" element={<AboutPage />} />
            {/* Not a redirect. Bouncing an unknown address to the index loses
                both the fact that it was wrong and the address itself. */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  );
}
