import { Outlet } from "react-router-dom";
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
    ],
  },
];

export default PublicRoutes;
