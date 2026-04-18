import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { isRestockDemoActive, setRestockDemo } from "@/data/restock-demo-mock";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Floating toggle to enable/disable ReStock demo mode.
 * Persists in localStorage. When active, ReStock pages display mock fixtures.
 */
export function DemoModeToggle() {
  const [active, setActive] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    setActive(isRestockDemoActive());
    const sync = () => setActive(isRestockDemoActive());
    window.addEventListener("restock-demo-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("restock-demo-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = () => {
    setRestockDemo(!active);
    setActive(!active);
    // Force refetch of all queries so demo data shows immediately
    qc.invalidateQueries();
  };

  return (
    <button
      onClick={toggle}
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-4 py-2.5 shadow-lg text-xs font-semibold transition-all ${
        active
          ? "bg-[#00B85C] text-white hover:bg-[#00A050]"
          : "bg-white text-[#1E252F] border border-[#D0D5DC] hover:bg-[#F7F8FA]"
      }`}
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      title={active ? "Désactiver le mode démo" : "Activer le mode démo"}
    >
      {active ? <X size={14} /> : <Sparkles size={14} />}
      {active ? "Démo active" : "Activer démo"}
    </button>
  );
}
