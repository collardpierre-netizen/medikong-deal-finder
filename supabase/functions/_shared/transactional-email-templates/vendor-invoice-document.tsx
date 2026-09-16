import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/cms-images/email-logo-horizontal.png'

interface Props {
  vendorName?: string
  invoiceNumber?: string
  kindLabel?: string
  amount?: string
  dueDate?: string
  reference?: string
  iban?: string
  beneficiary?: string
  pdfUrl?: string
  isSelfBilling?: boolean
}

const VendorInvoiceDocumentEmail = ({
  vendorName = 'Fournisseur',
  invoiceNumber = '',
  kindLabel = 'Facture',
  amount = '0,00 EUR',
  dueDate = '',
  reference = '',
  iban = 'BE86 7320 7305 0650',
  beneficiary = 'MediKong',
  pdfUrl = '#',
  isSelfBilling = false,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>{kindLabel} {invoiceNumber} — {amount}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>Bonjour {vendorName},</Heading>
        <Text style={text}>
          Voici votre document <strong>{kindLabel}</strong> {invoiceNumber ? <>n° <strong>{invoiceNumber}</strong></> : null}.
        </Text>

        <Section style={box}>
          <Text style={boxLabel}>Montant TVAC</Text>
          <Text style={boxAmount}>{amount}</Text>
          {dueDate ? <Text style={boxMeta}>Échéance : {dueDate}</Text> : null}
        </Section>

        <Section style={bank}>
          <Text style={bankTitle}>Paiement par virement SEPA</Text>
          <Text style={bankLine}>Bénéficiaire : <strong>{beneficiary}</strong></Text>
          <Text style={bankLine}>IBAN : <strong>{iban}</strong></Text>
          {reference ? <Text style={bankLine}>Communication : <strong>{reference}</strong></Text> : null}
          <Text style={bankNote}>
            Le PDF joint au lien ci-dessous contient un QR de paiement SEPA : scannez-le avec votre
            application bancaire, le bénéficiaire, l'IBAN, le montant et la communication sont pré-remplis.
          </Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
          <Button href={pdfUrl} style={button}>Télécharger la facture PDF</Button>
        </Section>

        <Text style={smallText}>Ce lien de téléchargement est valable 7 jours.</Text>

        <Hr style={divider} />
        <Text style={legalText}>
          {isSelfBilling
            ? "Cette facture est émise par MediKong au nom et pour le compte de votre société, en vertu du mandat de facturation signé lors de votre inscription. Le compte de paiement indiqué est celui de MediKong."
            : "Facture émise par Balooh SRL (MediKong). Merci d'indiquer la communication lors du virement afin que le paiement soit rapproché automatiquement."}
        </Text>

        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VendorInvoiceDocumentEmail,
  subject: (data: Record<string, any>) =>
    `${data.kindLabel || 'Facture'} ${data.invoiceNumber || ''} — MediKong`.replace(/\s+/g, ' ').trim(),
  displayName: 'Facture fournisseur (coordonnées bancaires MediKong)',
  previewData: {
    vendorName: 'Medista',
    invoiceNumber: 'FC-2026-0042',
    kindLabel: 'Facture de commission MediKong',
    amount: '1 463,43 €',
    dueDate: '30 sept. 2026',
    reference: 'FC-2026-0042',
    pdfUrl: 'https://example.com/facture.pdf',
    isSelfBilling: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const smallText = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 12px' }
const box = { backgroundColor: '#f0f6ff', border: '1px solid #c7ddff', borderRadius: '10px', padding: '20px', textAlign: 'center' as const, margin: '0 0 12px' }
const boxLabel = { fontSize: '12px', color: '#1B5BDA', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: '700' as const, margin: '0 0 6px' }
const boxAmount = { fontSize: '28px', fontWeight: '800' as const, color: '#1e3a5f', margin: '0 0 4px' }
const boxMeta = { fontSize: '12px', color: '#6b7280', margin: '0' }
const bank = { border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px', margin: '0 0 8px' }
const bankTitle = { fontSize: '12px', color: '#1B5BDA', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: '700' as const, margin: '0 0 10px' }
const bankLine = { fontSize: '14px', color: '#1e3a5f', margin: '0 0 4px' }
const bankNote = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '10px 0 0' }
const button = { backgroundColor: '#1B5BDA', color: '#ffffff', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block' }
const divider = { borderColor: '#d1d5db', margin: '24px 0' }
const legalText = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 24px', fontStyle: 'italic' as const }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
