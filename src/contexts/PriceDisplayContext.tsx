import { createContext, useContext, useState, type ReactNode } from "react";

interface PriceDisplayContextType {
  isTVAC: boolean;
  setIsTVAC: (v: boolean) => void;
  toggleTVAC: () => void;
}

const PriceDisplayContext = createContext<PriceDisplayContextType>({
  isTVAC: false,
  setIsTVAC: () => {},
  toggleTVAC: () => {},
});

export function PriceDisplayProvider({ children }: { children: ReactNode }) {
  const [isTVAC, setIsTVAC] = useState(false); // default HTVA for B2B
  return (
    <PriceDisplayContext.Provider value={{ isTVAC, setIsTVAC, toggleTVAC: () => setIsTVAC((v) => !v) }}>
      {children}
    </PriceDisplayContext.Provider>
  );
}

export function usePriceDisplay() {
  return useContext(PriceDisplayContext);
}
