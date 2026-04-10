import { useEffect } from "react";
import { Outlet, useNavigate, useSearchParams, useLocation } from "react-router";
import { setFeedToken, setOnboardingComplete } from "../utils/userId";

export function Root() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  useEffect(() => {
    const token = searchParams.get("t");
    if (token) {
      setFeedToken(token);
      setOnboardingComplete();

      // Only redirect to /feed if we're on the landing page (root path).
      // For deep links like /article/:id?t=..., stay on the current route.
      if (location.pathname === "/" || location.pathname === "") {
        navigate("/feed", { replace: true });
      }
    }
  }, [searchParams, navigate, location.pathname]);

  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
