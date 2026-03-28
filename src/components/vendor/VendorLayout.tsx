import { useState } from "react";
import { Outlet } from "react-router-dom";
import { VendorSidebar } from "./VendorSidebar";
import { VendorTopBar } from "./VendorTopBar";
import { useIsMobile } from "@/hooks/use-mobile";

export default function VendorLayout() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: "#F1F5F9" }}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={
          isMobile
            ? `fixed inset-y-0 left-0 z-50 transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
            : ""
        }
      >
        <VendorSidebar onNavigate={isMobile ? () => setSidebarOpen(false) : undefined} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <VendorTopBar onMenuClick={isMobile ? () => setSidebarOpen((v) => !v) : undefined} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="anim-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
