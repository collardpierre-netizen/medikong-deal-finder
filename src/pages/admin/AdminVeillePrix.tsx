import AdminTopBar from "@/components/admin/AdminTopBar";
import { Globe } from "lucide-react";

const AdminVeillePrix = () => {
  return (
    <div>
      <AdminTopBar title="Veille prix" subtitle="Surveillance concurrentielle" />
      <div className="p-8 text-center rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <Globe size={48} className="mx-auto mb-4" style={{ color: "#8B95A5" }} />
        <h3 className="text-[16px] font-bold mb-2" style={{ color: "#1D2530" }}>Veille prix</h3>
        <p className="text-[13px]" style={{ color: "#8B95A5" }}>
          Ce module sera disponible lorsque les tables de veille marché seront ajoutées au schéma V5.
        </p>
      </div>
    </div>
  );
};

export default AdminVeillePrix;