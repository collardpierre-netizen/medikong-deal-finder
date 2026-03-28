import AdminTopBar from "@/components/admin/AdminTopBar";
import { Shield, CheckCircle2 } from "lucide-react";

const AdminReglementaire = () => {
  return (
    <div>
      <AdminTopBar title="Conformité réglementaire" subtitle="Surveillance MDR, AFMPS et certifications" />
      <div className="p-8 text-center rounded-lg" style={{ backgroundColor: "#fff", border: "1px solid #E2E8F0" }}>
        <Shield size={48} className="mx-auto mb-4" style={{ color: "#8B95A5" }} />
        <h3 className="text-[16px] font-bold mb-2" style={{ color: "#1D2530" }}>Module conformité</h3>
        <p className="text-[13px]" style={{ color: "#8B95A5" }}>
          Ce module sera disponible lorsque la table de conformité sera ajoutée au schéma V5.
        </p>
      </div>
    </div>
  );
};

export default AdminReglementaire;