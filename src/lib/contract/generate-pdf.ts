import jsPDF from "jspdf";
import {
  CONTRACT_ARTICLES,
  CONTRACT_VERSION,
  ContractMediKongData,
  ContractVendorData,
  MEDIKONG_DEFAULTS,
} from "./mandat-facturation-template";

interface GeneratePdfArgs {
  vendor: ContractVendorData;
  medikong?: ContractMediKongData;
  signedAt: Date;
  signatureDataUrl: string; // PNG base64 de la signature
  signatureMethod: "canvas" | "typed_name";
  signerName: string;
  signerRole?: string | null;
}

export async function generateContractPdf({
  vendor,
  medikong = MEDIKONG_DEFAULTS,
  signedAt,
  signatureDataUrl,
  signatureMethod,
  signerName,
  signerRole,
}: GeneratePdfArgs): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, opts?: { fontSize?: number; bold?: boolean; spacing?: number }) => {
    const fontSize = opts?.fontSize ?? 10;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 0.45;
    ensureSpace(lines.length * lineHeight);
    doc.text(lines, margin, y);
    y += lines.length * lineHeight + (opts?.spacing ?? 2);
  };

  // Titre
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CONVENTION DE MANDAT DE FACTURATION", pageWidth / 2, y, { align: "center" });
  y += 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    "Conformément à l'article 53 §2 du Code de la TVA belge — Circulaire AGFisc N° 53/2013",
    pageWidth / 2,
    y,
    { align: "center" }
  );
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Version ${CONTRACT_VERSION}`, pageWidth / 2, y, { align: "center" });
  y += 8;

  // Parties
  writeWrapped("ENTRE LES SOUSSIGNÉS", { fontSize: 11, bold: true, spacing: 3 });

  writeWrapped("Le Mandant (ci-après désigné « le Vendeur ») :", { fontSize: 10, bold: true });
  writeWrapped(vendor.company_name);
  if (vendor.legal_form) writeWrapped(`Forme juridique : ${vendor.legal_form}`);
  if (vendor.address) writeWrapped(`Siège social : ${vendor.address}`);
  if (vendor.bce) writeWrapped(`Numéro d'entreprise (BCE) : ${vendor.bce}`);
  if (vendor.vat) writeWrapped(`Numéro de TVA : ${vendor.vat}`);
  writeWrapped(
    `Représenté par : ${vendor.representative_name}${vendor.representative_role ? `, en qualité de ${vendor.representative_role}` : ""}`,
    { spacing: 4 }
  );

  writeWrapped("ET", { fontSize: 10, bold: true, spacing: 2 });

  writeWrapped("Le Mandataire (ci-après désigné « MediKong ») :", { fontSize: 10, bold: true });
  writeWrapped(`MediKong ${medikong.legal_form}`);
  writeWrapped(`Siège social : ${medikong.address}`);
  writeWrapped(`Numéro d'entreprise (BCE) : ${medikong.bce}`);
  writeWrapped(`Numéro de TVA : ${medikong.vat}`);
  writeWrapped(`Représenté par : ${medikong.representative_name}, en qualité de ${medikong.representative_role}`, { spacing: 6 });

  // Articles
  for (const article of CONTRACT_ARTICLES) {
    writeWrapped(`Article ${article.number} — ${article.title}`, { fontSize: 11, bold: true, spacing: 3 });
    for (const p of article.paragraphs) {
      if (typeof p === "string") {
        writeWrapped(p, { spacing: 3 });
      } else if (p.type === "list") {
        for (const item of p.items) {
          writeWrapped(`  • ${item}`, { spacing: 2 });
        }
        y += 1;
      } else if (p.type === "subarticle") {
        writeWrapped(`${p.number} — ${p.text}`, { spacing: 3 });
      }
    }
    y += 2;
  }

  // Signature
  ensureSpace(60);
  y += 4;
  const signatureLocation = vendor.signature_location || "—";
  const dateStr = signedAt.toLocaleDateString("fr-BE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  writeWrapped(`Fait à ${signatureLocation}, le ${dateStr}`, { bold: true, spacing: 6 });

  // Bloc Vendeur
  writeWrapped("Pour le Vendeur (Mandant) :", { bold: true, spacing: 2 });
  writeWrapped(signerName);
  if (signerRole) writeWrapped(signerRole);
  writeWrapped(vendor.company_name, { spacing: 2 });

  // Image signature
  try {
    ensureSpace(28);
    doc.addImage(signatureDataUrl, "PNG", margin, y, 60, 22);
    y += 24;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text(
      `Signature électronique (${signatureMethod === "canvas" ? "tracée" : "saisie"}) — Valeur juridique eIDAS n°910/2014`,
      margin,
      y
    );
    y += 6;
  } catch {
    writeWrapped("[Signature électronique apposée]", { fontSize: 9 });
  }

  writeWrapped("Pour MediKong (Mandataire) :", { bold: true, spacing: 2 });
  writeWrapped(`${medikong.representative_name} — ${medikong.representative_role}`);
  writeWrapped("Signature électronique pré-enregistrée", { fontSize: 9 });

  return doc.output("blob");
}

/**
 * Hash SHA-256 d'un Blob (valeur probante : empreinte du document signé).
 */
export async function hashBlob(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
