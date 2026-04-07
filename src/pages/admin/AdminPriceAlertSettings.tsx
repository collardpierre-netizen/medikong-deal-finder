import { useNavigate } from "react-router-dom";
import { useAlertSettings, useUpdateAlertSettings } from "@/hooks/usePriceAlerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function AdminPriceAlertSettings() {
  const navigate = useNavigate();
  const { data: settings, isLoading } = useAlertSettings();
  const updateSettings = useUpdateAlertSettings();

  const [form, setForm] = useState({
    info_threshold: 0,
    warning_threshold: 5,
    critical_threshold: 15,
    competitive_margin: 1,
    auto_notify_info: false,
    auto_notify_warning: false,
    auto_notify_critical: true,
    escalation_hours: 48,
    superadmin_report_frequency: "daily",
  });

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate(form, {
      onSuccess: () => toast.success("Configuration sauvegardée"),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-[#8B95A5]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/price-alerts")}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1D2530" }}>Configuration des alertes prix</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#616B7C" }}>Seuils de déclenchement et notifications automatiques</p>
        </div>
      </div>

      {/* Thresholds */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-6 space-y-5">
        <h3 className="text-[14px] font-bold" style={{ color: "#1D2530" }}>Seuils de sévérité</h3>
        <p className="text-[12px]" style={{ color: "#8B95A5" }}>
          Définissez les pourcentages d'écart qui déclenchent chaque niveau d'alerte.
        </p>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-[12px] font-medium" style={{ color: "#616B7C" }}>
              ⚠️ Info (à partir de %)
            </label>
            <Input
              type="number"
              value={form.info_threshold}
              onChange={e => setForm(f => ({ ...f, info_threshold: Number(e.target.value) }))}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium" style={{ color: "#616B7C" }}>
              🔶 Warning (à partir de %)
            </label>
            <Input
              type="number"
              value={form.warning_threshold}
              onChange={e => setForm(f => ({ ...f, warning_threshold: Number(e.target.value) }))}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium" style={{ color: "#616B7C" }}>
              🔴 Critique (à partir de %)
            </label>
            <Input
              type="number"
              value={form.critical_threshold}
              onChange={e => setForm(f => ({ ...f, critical_threshold: Number(e.target.value) }))}
              className="mt-1 h-9"
            />
          </div>
        </div>
      </div>

      {/* Competitive margin */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-6 space-y-4">
        <h3 className="text-[14px] font-bold" style={{ color: "#1D2530" }}>Marge compétitive</h3>
        <p className="text-[12px]" style={{ color: "#8B95A5" }}>
          Pourcentage de remise supplémentaire appliqué au prix suggéré pour positionner le vendeur légèrement en dessous.
        </p>
        <div className="max-w-xs">
          <Input
            type="number"
            step={0.5}
            value={form.competitive_margin}
            onChange={e => setForm(f => ({ ...f, competitive_margin: Number(e.target.value) }))}
            className="h-9"
          />
        </div>
      </div>

      {/* Auto notifications */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-6 space-y-5">
        <h3 className="text-[14px] font-bold" style={{ color: "#1D2530" }}>Notifications automatiques</h3>
        <p className="text-[12px]" style={{ color: "#8B95A5" }}>
          Activer l'envoi automatique de notifications aux vendeurs selon le niveau de sévérité.
        </p>

        <div className="space-y-3">
          {[
            { key: "auto_notify_info" as const, label: "⚠️ Info" },
            { key: "auto_notify_warning" as const, label: "🔶 Warning" },
            { key: "auto_notify_critical" as const, label: "🔴 Critique" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between">
              <span className="text-[13px]" style={{ color: "#1D2530" }}>{item.label}</span>
              <Switch
                checked={form[item.key]}
                onCheckedChange={v => setForm(f => ({ ...f, [item.key]: v }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Escalation */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] p-6 space-y-4">
        <h3 className="text-[14px] font-bold" style={{ color: "#1D2530" }}>Escalade</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] font-medium" style={{ color: "#616B7C" }}>
              Re-notification après (heures)
            </label>
            <Input
              type="number"
              value={form.escalation_hours}
              onChange={e => setForm(f => ({ ...f, escalation_hours: Number(e.target.value) }))}
              className="mt-1 h-9"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium" style={{ color: "#616B7C" }}>
              Rapport superadmin
            </label>
            <Select
              value={form.superadmin_report_frequency}
              onValueChange={v => setForm(f => ({ ...f, superadmin_report_frequency: v }))}
            >
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Quotidien</SelectItem>
                <SelectItem value="weekly">Hebdomadaire</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
          Sauvegarder
        </Button>
      </div>
    </div>
  );
}
