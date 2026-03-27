import { Outlet, Navigate } from "react-router-dom";
import { I18nProvider } from "@/contexts/I18nContext";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Shield } from "lucide-react";

const AdminLayout = () => {
  const location = useLocation();
  const { isAdmin, loading } = useAdminAuth();

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
        <AdminSidebar />
        <main className="ml-[240px] min-h-screen p-7">
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
