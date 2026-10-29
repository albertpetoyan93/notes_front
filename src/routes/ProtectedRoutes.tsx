import React, { lazy } from "react";

const NotesPage = lazy(() => import("../pages/notes/NotesPage"));
const CompanyPage = lazy(() => import("../pages/company/CompanyPage"));
const SecurityPage = lazy(() => import("../pages/settings/SecurityPage"));
const SecretLinksPage = lazy(() => import("../pages/settings/SecretLinksPage"));
const BillingPage = lazy(() => import("../pages/settings/BillingPage"));
const AdminPage = lazy(() => import("../pages/admin/AdminPage"));

interface RouteConfig {
  path?: string;
  element: React.ReactNode;
  roles?: string[];
  children?: RouteConfig[];
  index?: boolean;
}

const ProtectedRoutes: RouteConfig[] = [
  {
    path: "/",
    element: <NotesPage />,
    index: true,
  },
  {
    path: "/notes",
    element: <NotesPage />,
  },
  {
    path: "/company/:id",
    element: <CompanyPage />,
  },
  {
    path: "/settings/security",
    element: <SecurityPage />,
  },
  {
    path: "/settings/billing",
    element: <BillingPage />,
  },
  {
    path: "/links",
    element: <SecretLinksPage />,
  },
  {
    path: "/admin",
    element: <AdminPage />,
  },
];

export default ProtectedRoutes;
