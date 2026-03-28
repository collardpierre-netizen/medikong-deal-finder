import { Outlet } from "react-router-dom";
import { VendorSidebar } from "./VendorSidebar";
import { VendorTopBar } from "./VendorTopBar";

export default function VendorLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ backgroundColor: "#F1F5F9" }}>
      <VendorSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <VendorTopBar />
        <main className="flex-1 overflow-auto p-6">
          <div className="anim-up">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
