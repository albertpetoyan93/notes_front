import { useAuthStore } from "../store/authStore";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { me } = useAuthStore();

  // If no roles specified, allow all authenticated users
  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>;
  }

  // Check if user has required role
  if (me?.role && allowedRoles.includes(me.role)) {
    return <>{children}</>;
  }

  // Redirect to unauthorized page or dashboard if user doesn't have access
  //   return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default ProtectedRoute;
