import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'

const Home = lazy(() => import('./pages/Home'))
const AppShell = lazy(() => import('./pages/AppShell'))
const Docs = lazy(() => import('./pages/Docs'))

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<div role="status" className="grid min-h-screen place-items-center bg-paper font-sans text-sm font-semibold text-moss-deep dark:bg-moss-night-deep dark:text-text-dark">Loading DocLense…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/app" element={<AppShell />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
