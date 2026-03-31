import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function VendorStripeRefreshPage() {
  const [searchParams] = useSearchParams();
  const vendorId = searchParams.get("vendor_id");

  useEffect(() => {
    if (!vendorId) return;
    const refresh = async () => {
      const { data } = await supabase.functions.invoke("stripe-connect-onboarding", {
        body: { action: "refresh-link", vendor_id: vendorId, origin: window.location.origin },
      });
      if (data?.url) {
        window.location.href = data.url;
      }
    };
    refresh();
  }, [vendorId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#1B5BDA" }} />
      <p className="text-sm" style={{ color: "#616B7C" }}>Régénération du lien de configuration...</p>
    </div>
  );
}
