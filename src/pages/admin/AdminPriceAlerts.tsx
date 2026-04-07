import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePriceAlerts, usePriceAlertStats, useUpdateAlertStatus } from "@/hooks/usePriceAlerts";
import KpiCard from "@/components/admin/KpiCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle, TrendingDown, Package, Store, Target, CheckCircle,
  Eye, Bell, ChevronRight, Search, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const severityConfig = {
  info: { label: "Info", color: "#F59E0B", bg: "#FFFBEB", icon: "⚠️" },
  warning: { label: "Warning", color: "#F97316", bg: "#FFF7ED", icon: "🔶" },
  critical: { label: "Critique", color: "#EF4444", bg: "#FEF2F2", icon: "🔴" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  new: { label: "Nouvelle", color: "#3B82F6" },
  seen: { label: "Vue", color: "#8B5CF6" },
  in_progress: { label: "En cours", color: "#F59E0B" },
  resolved: { label: "Résolue", color: "#10B981" },
  auto_resolved: { label: "Auto-résolue", color: "#059669" },
};

export default function AdminPriceAlerts() {
  const navigate = useNavigate();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filters = {
    ...(severityFilter !== "all" ? { severity: severityFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };

  const { data: alerts = [], isLoading } = usePriceAlerts(filters);
  const { data: stats } = usePriceAlertStats();
  const updateStatus = useUpdateAlertStatus();

  const filteredAlerts = search
    ? alerts.filter(a =>
        a.product?.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.product?.gtin?.includes(search) ||
        a.product?.brand_name?.toLowerCase().includes(search.toLowerCase())
      )
    : alerts;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredAlerts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAlerts.map(a => a.id)));
    }
  };

  const handleBulkNotify = () => {
    toast.success(`Notification envoyée pour ${selectedIds.size} alertes`);
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1D2530" }}>Alertes Prix</h1>
          <p className="text-[13px] mt-0.5" style={{ color: "#616B7C" }}>
            Surveillance de la compétitivité tarifaire vs marché et offres externes
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/admin/price-alerts/settings")}
        >
          <Target size={14} className="mr-1.5" /> Configuration
        </Button>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            icon={AlertTriangle}
            label="Alertes actives"
            value={String(stats.total)}
            iconColor="#EF4444"
            iconBg="#FEF2F2"
          />
          <KpiCard
            icon={Package}
            label="Produits concernés"
            value={String(stats.uniqueProducts)}
            iconColor="#F59E0B"
            iconBg="#FFFBEB"
          />
          <KpiCard
            icon={Store}
            label="Vendeurs impactés"
            value={String(stats.uniqueVendors)}
            iconColor="#8B5CF6"
            iconBg="#F5F3FF"
          />
          <KpiCard
            icon={TrendingDown}
            label="Écart moyen"
            value={`+${stats.avgGap}%`}
            iconColor="#EF4444"
            iconBg="#FEF2F2"
          />
          <KpiCard
            icon={CheckCircle}
            label="Taux d'alignement"
            value={`${stats.alignmentRate}%`}
            iconColor="#10B981"
            iconBg="#ECFDF5"
          />
        </div>
      )}

      {/* Severity badges */}
      {stats && (
        <div className="flex gap-3">
          {(["info", "warning", "critical"] as const).map(sev => (
            <div
              key={sev}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-semibold"
              style={{ backgroundColor: severityConfig[sev].bg, color: severityConfig[sev].color }}
            >
              <span>{severityConfig[sev].icon}</span>
              {severityConfig[sev].label}: {stats.bySeverity[sev]}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8B95A5]" />
          <Input
            placeholder="Rechercher produit, GTIN, marque..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-[13px]"
          />
        </div>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-36 h-9 text-[13px]"><SelectValue placeholder="Sévérité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critique</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9 text-[13px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="new">Nouvelle</SelectItem>
            <SelectItem value="seen">Vue</SelectItem>
            <SelectItem value="in_progress">En cours</SelectItem>
            <SelectItem value="resolved">Résolue</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <Button size="sm" onClick={handleBulkNotify} className="h-9">
            <Bell size={14} className="mr-1.5" />
            Notifier {selectedIds.size} vendeur(s)
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-[10px] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#8B95A5]" />
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle size={48} className="text-[#10B981] mb-4" />
            <h3 className="text-[15px] font-bold" style={{ color: "#1D2530" }}>Aucune alerte</h3>
            <p className="text-[13px] mt-1" style={{ color: "#8B95A5" }}>
              Tous les prix MediKong sont compétitifs par rapport au marché.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[#E2E8F0]" style={{ backgroundColor: "#F8FAFC" }}>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C] w-8">
                    <Checkbox
                      checked={selectedIds.size === filteredAlerts.length && filteredAlerts.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Produit</th>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Marque</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Prix MediKong</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Prix référence</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Écart</th>
                  <th className="text-center px-4 py-3 font-medium text-[#616B7C]">Sévérité</th>
                  <th className="text-center px-4 py-3 font-medium text-[#616B7C]">Vendeurs</th>
                  <th className="text-left px-4 py-3 font-medium text-[#616B7C]">Depuis</th>
                  <th className="text-center px-4 py-3 font-medium text-[#616B7C]">Statut</th>
                  <th className="text-right px-4 py-3 font-medium text-[#616B7C]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map(alert => {
                  const sev = severityConfig[alert.severity];
                  const stat = statusConfig[alert.status] || statusConfig.new;
                  return (
                    <tr key={alert.id} className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.has(alert.id)}
                          onCheckedChange={() => toggleSelect(alert.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {alert.product?.image_url && (
                            <img
                              src={alert.product.image_url}
                              alt=""
                              className="w-8 h-8 rounded object-cover border border-[#E2E8F0]"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[200px]" style={{ color: "#1D2530" }}>
                              {alert.product?.name || "—"}
                            </p>
                            <p className="text-[11px]" style={{ color: "#8B95A5" }}>
                              {alert.product?.gtin || ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#616B7C]">{alert.product?.brand_name || "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium" style={{ color: "#1D2530" }}>
                        {alert.best_medikong_price.toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-right font-mono" style={{ color: "#616B7C" }}>
                        {alert.reference_price.toFixed(2)} €
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-semibold" style={{ color: "#EF4444" }}>
                          +{alert.gap_percentage.toFixed(1)}%
                        </span>
                        <br />
                        <span className="text-[11px] font-mono" style={{ color: "#8B95A5" }}>
                          +{alert.gap_amount.toFixed(2)} €
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{ backgroundColor: sev.bg, color: sev.color }}
                        >
                          {sev.icon} {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium" style={{ color: "#1D2530" }}>
                        {alert.vendor_count}
                      </td>
                      <td className="px-4 py-3 text-[#8B95A5]">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
                          style={{ backgroundColor: stat.color }}
                        >
                          {stat.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[12px]"
                            onClick={() => navigate(`/admin/price-alerts/${alert.id}`)}
                          >
                            <Eye size={13} className="mr-1" /> Détail
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
