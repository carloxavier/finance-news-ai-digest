import { useEffect } from "react";
import { Outlet, useNavigate, useSearchParams } from "react-router";
import { setFeedToken, setOnboardingComplete } from "../utils/userId";

export function Root() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("t");
    if (token) {
      setFeedToken(token);
      setOnboardingComplete();
      navigate("/feed", { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen">
      <Outlet />
    </div>
  );
}
