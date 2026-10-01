import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { BrandLockup } from "../components/header/LeftHeader";
import useAuth from "../hooks/useAuth";
import { useAuthStore } from "../store/authStore";
import { keevoReturnPath } from "../utils/keevoReturn";

const PublicLayout = () => {
  const navigate = useNavigate();
  const { getMe } = useAuth();
  const { me } = useAuthStore();

  useEffect(() => {
    if (me) {
      navigate(keevoReturnPath() || "/");
      return;
    }

    let cancelled = false;
    getMe()
      .then((res) => {
        if (!cancelled && res) {
          navigate(keevoReturnPath() || "/");
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
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
      }}
    >
      <BrandLockup large />
      <Outlet />
    </div>
  );
};

export default PublicLayout;
