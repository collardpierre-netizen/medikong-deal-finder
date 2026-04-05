import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { I18nProvider } from "@/contexts/I18nContext";
import { ImportProvider } from "@/contexts/ImportContext";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Shield, Menu, X } from "lucide-react";

const AdminLayout = () => {
  const location = useLocation();
  const { isAdmin, loading } = useAdminAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#0F172A" }}>
        <div className="text-center">
          <Shield size={32} style={{ color: "#3B82F6" }} className="mx-auto mb-3 animate-pulse" />
          <p className="text-[13px]" style={{ color: "#8B95A5" }}>Vérification des droits...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <I18nProvider>
      <div className="min-h-screen" style={{ backgroundColor: "#F1F5F9", fontFamily: "'DM Sans', sans-serif" }}>
        {/* Desktop sidebar */}
        <div className="hidden lg:block">
          <AdminSidebar />
        </div>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="relative w-[260px] h-full">
              <AdminSidebar />
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-md bg-white/10 text-white hover:bg-white/20 z-10"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-[#E2E8F0]" style={{ backgroundColor: "#1E293B" }}>
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-md text-white hover:bg-white/10">
            <Menu size={20} />
          </button>
          <span className="text-white text-sm font-semibold">MediKong Admin</span>
        </div>

        <main className="lg:ml-[240px] min-h-screen p-4 lg:p-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </I18nProvider>
  );
};

export default AdminLayout;
