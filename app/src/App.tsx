import { lazy } from 'react';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { Shell } from './app/Shell';

const Portfolio = lazy(() => import('./features/portfolio/PortfolioPage'));
const Twin = lazy(() => import('./features/twin/TwinPage'));
const Schedule = lazy(() => import('./features/schedule/SchedulePage'));
const WhatIf = lazy(() => import('./features/whatif/WhatIfPage'));
const Procurement = lazy(() => import('./features/procurement/ProcurementPage'));
const Assets = lazy(() => import('./features/assets/AssetsPage'));
const Cost = lazy(() => import('./features/cost/CostPage'));
const Hse = lazy(() => import('./features/hse/HsePage'));
const Docs = lazy(() => import('./features/docs/DocsPage'));
const Reports = lazy(() => import('./features/reports/ReportsPage'));
const WorkOrders = lazy(() => import('./features/workorders/WorkOrdersPage'));
const Admin = lazy(() => import('./features/admin/AdminPage'));
const Models = lazy(() => import('./features/admin/ModelsPage'));

// Hash routing keeps the packaged demo working behind any static server (no SPA fallback needed).
const router = createHashRouter([
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Portfolio /> },
      { path: 'twin', element: <Twin /> },
      { path: 'schedule', element: <Schedule /> },
      { path: 'whatif/*', element: <WhatIf /> },
      { path: 'procurement', element: <Procurement /> },
      { path: 'assets', element: <Assets /> },
      { path: 'cost', element: <Cost /> },
      { path: 'hse', element: <Hse /> },
      { path: 'docs', element: <Docs /> },
      { path: 'reports', element: <Reports /> },
      { path: 'workorders', element: <WorkOrders /> },
      { path: 'admin', element: <Admin /> },
      { path: 'models', element: <Models /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
