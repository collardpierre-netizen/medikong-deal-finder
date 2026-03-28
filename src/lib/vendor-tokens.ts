// Vendor Dashboard Design Tokens
export const S = {
  bg: "#F1F5F9",
  card: "#FFFFFF",
  text: "#1D2530",
  sec: "#616B7C",
  ter: "#8B95A5",
  blue: "#1B5BDA",
  navy: "#1E293B",
  green: "#059669",
  red: "#EF4343",
  amber: "#F59E0B",
  pink: "#E70866",
  purple: "#7C3AED",
  line: "#E2E8F0",
  lb: "#CBD5E1",
};

export const vendorProfile = {
  name: "Pharmamed SA",
  level: "Gold" as const,
  score: 87,
  levelNext: "Platinum",
  scoreToNext: 93,
  commissionRate: 12,
  since: "2024-06",
  country: "BE",
  vat: "BE0123.456.789",
  contacts: 3,
};

export const commissionRates = [
  { level: "Bronze", minScore: 0, maxScore: 59, rate: 14 },
  { level: "Silver", minScore: 60, maxScore: 79, rate: 13 },
  { level: "Gold", minScore: 80, maxScore: 92, rate: 12 },
  { level: "Platinum", minScore: 93, maxScore: 100, rate: 10 },
];

export const categoryIconMap: Record<string, { icon: string; color: string }> = {
  EPI: { icon: "Shield", color: S.blue },
  Diagnostic: { icon: "Activity", color: S.purple },
  Pansements: { icon: "Plus", color: S.pink },
  Hygiène: { icon: "Zap", color: S.green },
  Injection: { icon: "Target", color: S.red },
  Mobilité: { icon: "Truck", color: S.amber },
  Consommables: { icon: "Box", color: S.sec },
  Nutrition: { icon: "Package", color: "#16A34A" },
  Incontinence: { icon: "Layers", color: "#0891B2" },
  Dermocosmétique: { icon: "Star", color: "#C026D3" },
};

export const buyerTypeColors: Record<string, { text: string; bg: string }> = {
  Pharmacie: { text: S.blue, bg: S.blue + "18" },
  Hôpital: { text: S.purple, bg: S.purple + "18" },
  MRS: { text: S.pink, bg: S.pink + "18" },
  Infirmier: { text: S.green, bg: S.green + "18" },
  Cabinet: { text: S.amber, bg: S.amber + "18" },
  Parapharmacie: { text: S.sec, bg: S.sec + "18" },
};
