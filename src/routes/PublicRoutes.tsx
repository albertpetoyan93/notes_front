import { Navigate, Outlet } from "react-router-dom";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import RecoverPage from "../pages/auth/RecoverPage";
import RecoveryKeyPage from "../pages/auth/RecoveryKeyPage";
import ResetAccountPage from "../pages/auth/ResetAccountPage";
import LoginPage from "../pages/login/LoginPage";
import RegisterPage from "../pages/register/RegisterPage";

// ==============================|| PUBLIC ROUTES ||============================== //

const PublicRoutes = [
  {
    path: "/auth",
    element: <Outlet />,
    children: [
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
      {
        path: "forgot",
        element: <ForgotPasswordPage />,
      },
      {
        // Old password-reset links (before every account was end-to-end): ask for a new one.
        path: "reset",
        element: <Navigate to="/auth/forgot" replace />,
      },
      {
        path: "recover",
        element: <RecoverPage />,
      },
      {
        path: "recovery-key",
        element: <RecoveryKeyPage />,
      },
      {
        // From the "forgot password" email of an end-to-end account, without a recovery key.
        path: "reset-account",
        element: <ResetAccountPage />,
      },

    ],
  },
];

export default PublicRoutes;
