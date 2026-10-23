import React, { lazy } from "react";

const NotesPage = lazy(() => import("../pages/notes/NotesPage"));
const CompanyPage = lazy(() => import("../pages/company/CompanyPage"));
const SecurityPage = lazy(() => import("../pages/settings/SecurityPage"));
const SecretLinksPage = lazy(() => import("../pages/settings/SecretLinksPage"));

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
    path: "/links",
    element: <SecretLinksPage />,
  },
];

export default ProtectedRoutes;
