import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { useAuthStore } from "../store/authStore";

const PublicLayout = () => {
  const navigate = useNavigate();
  const { getMe } = useAuth();
  const { me } = useAuthStore();

  useEffect(() => {
    // Check for token in localStorage first
    const token = localStorage.getItem("access_token");
    if (token) {
      // Only call getMe if we have a token but no user data
      if (!me) {
        getMe()
          .then((res) => {
            if (res) {
              // User is authenticated, redirect to dashboard
              navigate("/");
            }
          })
          .catch(() => {
            // Token is invalid, stay on public layout
          });
      } else {
        // We already have user data, redirect immediately
        navigate("/");
      }
    }
  }, [navigate, getMe, me]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      <Outlet />
    </div>
  );
};

export default PublicLayout;
