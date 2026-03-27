import { Outlet } from "react-router-dom";
import { I18nProvider } from "@/contexts/I18nContext";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";

const AdminLayout = () => {
  const location = useLocation();

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
