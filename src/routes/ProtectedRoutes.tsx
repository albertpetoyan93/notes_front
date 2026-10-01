import React, { lazy } from "react";

const NotesPage = lazy(() => import("../pages/notes/NotesPage"));
const CompanyPage = lazy(() => import("../pages/company/CompanyPage"));

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
];

export default ProtectedRoutes;
