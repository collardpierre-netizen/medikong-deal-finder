import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, BarChart3, AlertOctagon } from "lucide-react";
import VendorPositioning from "./VendorPositioning";
import VendorMarketIntel from "./VendorMarketIntel";
import VendorCompetitorAlerts from "./VendorCompetitorAlerts";
import { useCurrentVendor } from "@/hooks/useCurrentVendor";
import { useCompetitorAlertsCount } from "@/hooks/useVendorCompetitorAlerts";

const TAB_BY_PATH: Record<string, string> = {
  "/vendor/positioning": "ranking",
  "/vendor/market-intel": "compare",
  "/vendor/competitor-alerts": "alerts",
};

const PATH_BY_TAB: Record<string, string> = {
  ranking: "/vendor/positioning",
  compare: "/vendor/market-intel",
  alerts: "/vendor/competitor-alerts",
};

export default function VendorMarketIntelHub() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: vendor } = useCurrentVendor();
  const { data: alertsCount = 0 } = useCompetitorAlertsCount(vendor?.id);

  const active = useMemo(
    () => TAB_BY_PATH[location.pathname] ?? "ranking",
    [location.pathname]
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1D2530]">Veille marché</h1>
        <p className="text-[13px] text-[#616B7C] mt-0.5">
          Classement, comparaison concurrentielle et alertes de prix par EAN
        </p>
      </div>

      <Tabs
        value={active}
        onValueChange={(v) => navigate(PATH_BY_TAB[v] ?? "/vendor/positioning")}
        className="w-full"
      >
        <TabsList className="bg-[#F1F5F9] p-1 h-auto">
          <TabsTrigger value="ranking" className="gap-2 data-[state=active]:bg-white">
            <Trophy size={14} />
            <span>Classement</span>
          </TabsTrigger>
          <TabsTrigger value="compare" className="gap-2 data-[state=active]:bg-white">
            <BarChart3 size={14} />
            <span>Comparaison EAN</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2 data-[state=active]:bg-white">
            <AlertOctagon size={14} />
            <span>Alertes</span>
            {alertsCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4343] text-white text-[10px] font-bold">
                {alertsCount > 9 ? "9+" : alertsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="mt-4">
          <VendorPositioning />
        </TabsContent>
        <TabsContent value="compare" className="mt-4">
          <VendorMarketIntel />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <VendorCompetitorAlerts />
        </TabsContent>
      </Tabs>
    </div>
  );
}
