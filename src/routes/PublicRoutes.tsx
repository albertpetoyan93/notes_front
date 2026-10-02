import { Outlet } from "react-router-dom";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
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
        path: "reset",
        element: <ResetPasswordPage />,
      },
    ],
  },
];

export default PublicRoutes;
