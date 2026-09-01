import * as XLSX from "xlsx";

/**
 * Export XLSX d'une commande à destination des fournisseurs.
 * Un onglet par fournisseur (produit, CNK, EAN, quantité, PU HT, total HT, TVA)
 * + un onglet "Synthèse" récapitulatif.
 */
export interface VendorXlsxLine {
  quantity?: number | null;
  unit_price_excl_vat?: number | null;
  vat_rate?: number | null;
  manual_label?: string | null;
  product_name?: string | null;
  manual_cnk_code?: string | null;
  manual_gtin?: string | null;
  products?: { name?: string | null; gtin?: string | null; cnk_code?: string | null } | null;
  vendors?: { company_name?: string | null; name?: string | null } | null;
  vendor_id?: string | null;
}

export interface VendorXlsxOrder {
  order_number?: string | null;
  created_at?: string | null;
  customer?: { company_name?: string | null; name?: string | null } | null;
  shipping_address_line1?: string | null;
  shipping_postal_code?: string | null;
  shipping_city?: string | null;
  shipping_country_code?: string | null;
}

function vendorLabel(l: VendorXlsxLine): string {
  return l.vendors?.company_name || l.vendors?.name || "Fournisseur";
}

function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Fournisseur";
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) candidate = `${base.slice(0, 25)} ${i++}`;
  used.add(candidate);
  return candidate;
}

export function buildVendorOrderWorkbook(order: VendorXlsxOrder, lines: VendorXlsxLine[]) {
  const wb = XLSX.utils.book_new();
  const orderNo = order.order_number || "commande";
  const customer = order.customer?.company_name || order.customer?.name || "";
  const shipTo = [
    order.shipping_address_line1,
    [order.shipping_postal_code, order.shipping_city].filter(Boolean).join(" "),
    order.shipping_country_code,
  ]
    .filter(Boolean)
    .join(", ");

  const groups = new Map<string, VendorXlsxLine[]>();
  for (const l of lines) {
    const key = vendorLabel(l);
    const arr = groups.get(key) || [];
    arr.push(l);
    groups.set(key, arr);
  }

  const summary: (string | number)[][] = [
    ["Commande", orderNo],
    ["Date", order.created_at ? new Date(order.created_at).toLocaleDateString("fr-BE") : ""],
    ["Client", customer],
    ["Livraison", shipTo],
    [],
    ["Fournisseur", "Lignes", "Quantité", "Total HT (€)"],
  ];

  const used = new Set<string>();
  for (const [vendor, vLines] of groups) {
    const rows: (string | number)[][] = [
      ["Commande", orderNo, "", "Client", customer],
      ["Livraison", shipTo],
      [],
      ["Produit", "CNK", "EAN / GTIN", "Quantité", "PU HT (€)", "Total HT (€)", "TVA %"],
    ];
    let totalHt = 0;
    let totalQty = 0;
    for (const l of vLines) {
      const qty = Number(l.quantity) || 0;
      const pu = Number(l.unit_price_excl_vat) || 0;
      const ht = qty * pu;
      totalHt += ht;
      totalQty += qty;
      rows.push([
        l.products?.name || l.product_name || "",
        l.products?.cnk_code || "",
        l.products?.gtin || "",
        qty,
        Number(pu.toFixed(2)),
        Number(ht.toFixed(2)),
        Number(l.vat_rate) || 0,
      ]);
    }
    rows.push([], ["", "", "Total", totalQty, "", Number(totalHt.toFixed(2)), ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 44 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 8 }];
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName(vendor, used));

    summary.push([vendor, vLines.length, totalQty, Number(totalHt.toFixed(2))]);
  }

  const wsSum = XLSX.utils.aoa_to_sheet(summary);
  wsSum["!cols"] = [{ wch: 34 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSum, "Synthese");
  // Place la synthèse en premier onglet
  wb.SheetNames = ["Synthese", ...wb.SheetNames.filter((n) => n !== "Synthese")];

  return wb;
}

export function downloadVendorOrderXlsx(order: VendorXlsxOrder, lines: VendorXlsxLine[]) {
  const wb = buildVendorOrderWorkbook(order, lines);
  XLSX.writeFile(wb, `commande-${order.order_number || "export"}-fournisseurs.xlsx`);
}
