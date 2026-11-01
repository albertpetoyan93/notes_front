import { Route, Routes } from "react-router-dom";
import PublicLayout from "../layouts/PublicLayout";
import ProtectedLayout from "../layouts/ProtectedLayout";
import { Outlet } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import React from "react";
import ProtectedRoutes from "./ProtectedRoutes";
import PublicRoutes from "./PublicRoutes";
import KeevoConnectPage from "../pages/keevo/KeevoConnectPage";
import SecretLinkPage from "../pages/secret/SecretLinkPage";
import ConfirmSupportRequestPage from "../pages/auth/ConfirmSupportRequestPage";

// Type for route structure
interface RouteConfig {
  path?: string;
  element: React.ReactNode;
  roles?: string[];
  children?: RouteConfig[];
  index?: boolean;
}

// Helper function to render routes recursively
const renderRoutes = (routes: RouteConfig[]): React.ReactNode => {
  return routes.map((route) => {
    const routeElement = route.children ? (
      <ProtectedRoute allowedRoles={route.roles}>
        <Outlet />
      </ProtectedRoute>
    ) : (
      <ProtectedRoute allowedRoles={route.roles}>
        {route.element}
      </ProtectedRoute>
    );

    if (route.index) {
      return <Route key="index" index element={routeElement} />;
    }

    return (
      <Route key={route.path} path={route.path} element={routeElement}>
        {route.children ? renderRoutes(route.children) : null}
      </Route>
    );
  });
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes - redirect to dashboard if authenticated */}
      <Route element={<PublicLayout />}>{renderRoutes(PublicRoutes)}</Route>
      <Route path="/keevo" element={<KeevoConnectPage />} />
      {/* One-time secret links: open to anyone with the link, signed in or not. */}
      <Route path="/s/:id" element={<SecretLinkPage />} />
      {/* Support's 2FA removal link: works signed in or not (PublicLayout would redirect). */}
      <Route path="/auth/confirm-support" element={<ConfirmSupportRequestPage />} />

      {/* Protected routes - redirect to login if not authenticated */}
      <Route element={<ProtectedLayout />}>
        {renderRoutes(ProtectedRoutes)}
      </Route>
    </Routes>
  );
};

export default AppRoutes;
