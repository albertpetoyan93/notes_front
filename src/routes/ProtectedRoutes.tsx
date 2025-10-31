import React, { lazy } from "react";

const NotesPage = lazy(() => import("../pages/notes/NotesPage"));

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
];

export default ProtectedRoutes;
