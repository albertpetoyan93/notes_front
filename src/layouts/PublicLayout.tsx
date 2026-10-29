import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { useAuthStore } from "../store/authStore";
import { returnPath } from "../utils/keevoReturn";

const PublicLayout = () => {
  const navigate = useNavigate();
  const { getMe } = useAuth();
  const { me } = useAuthStore();

  useEffect(() => {
    if (me) {
      navigate(returnPath() || "/");
      return;
    }

    let cancelled = false;
    getMe()
      .then((res) => {
        if (!cancelled && res) {
          navigate(returnPath() || "/");
        }
      })
      .catch(() => {
        // No session cookie. Stay on the login page.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-layout">
      <Outlet />
    </div>
  );
};

export default PublicLayout;
