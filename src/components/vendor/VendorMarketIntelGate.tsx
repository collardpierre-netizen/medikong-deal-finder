import { IntelligenceModuleGate } from "./IntelligenceModuleGate";

/**
 * @deprecated Utiliser `<IntelligenceModuleGate module="veille_marche">` directement.
 * Thin wrapper pour préserver le comportement Veille Marché existant.
 */
export function VendorMarketIntelGate({ children }: { children: React.ReactNode }) {
  return (
    <IntelligenceModuleGate
      module="veille_marche"
      title="Veille marché"
      subtitle="Module premium — classement, comparaison concurrentielle et alertes prix par EAN."
    >
      {children}
    </IntelligenceModuleGate>
  );
}
