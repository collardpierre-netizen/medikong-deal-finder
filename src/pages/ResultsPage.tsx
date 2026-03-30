import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

/**
 * /recherche now redirects to /catalogue with the search query.
 * All search + filtering is handled by CataloguePage.
 */
export default function ResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get("q") || "";

  useEffect(() => {
    // Redirect to catalogue with search param
    const target = q ? `/catalogue?q=${encodeURIComponent(q)}` : "/catalogue";
    navigate(target, { replace: true });
  }, [q, navigate]);

  return null;
}
