import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/cms-images/email-logo-horizontal.png'

interface Props {
  customerName?: string
  vendorName?: string
  invoiceNumber?: string
  orderNumber?: string
  amountIncVat?: string
  dueDate?: string
  payUrl?: string
  bankName?: string
  iban?: string
  bic?: string
  paymentReference?: string
}

const Email = ({
  customerName,
  vendorName = 'votre fournisseur',
  invoiceNumber = '',
  orderNumber = '',
  amountIncVat = '0,00 EUR',
  dueDate = '',
  payUrl = 'https://medikong.pro',
  bankName = '',
  iban = '',
  bic = '',
  paymentReference = '',
}: Props) => {
  const preview = `Lien de paiement — Facture ${invoiceNumber || orderNumber}`
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />
          <Heading style={h1}>Votre lien de paiement est prêt</Heading>
          <Text style={text}>Bonjour{customerName ? ` ${customerName}` : ''},</Text>
          <Text style={text}>
            Vous trouverez ci-dessous le lien pour régler la facture{' '}
            <strong>{invoiceNumber || orderNumber}</strong>
            {vendorName ? <> émise au nom et pour le compte de <strong>{vendorName}</strong></> : null}.
          </Text>

          <Section style={summaryBox}>
            <Text style={kvLabel}>Montant TTC</Text>
            <Text style={kvValue}>{amountIncVat}</Text>
            {dueDate ? (
              <>
                <Text style={kvLabel}>Échéance</Text>
                <Text style={kvValue}>{dueDate}</Text>
              </>
            ) : null}
          </Section>

          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={payUrl} style={button}>Payer par virement SEPA</Button>
          </Section>
          <Text style={smallCenter}>
            Le lien ouvre une page sécurisée Stripe qui vous fournira une référence
            de virement unique pour identifier votre paiement automatiquement.
          </Text>

          <Hr style={hr} />

          <Heading style={h2}>Ou virement bancaire classique</Heading>
          <Text style={text}>
            Si vous préférez régler directement depuis votre banque, utilisez les
            coordonnées ci-dessous. <strong>Indiquez impérativement la communication
            structurée</strong> pour un lettrage correct.
          </Text>
          <Section style={bankBox}>
            {bankName ? (
              <>
                <Text style={kvLabel}>Banque</Text>
                <Text style={kvValueSmall}>{bankName}</Text>
              </>
            ) : null}
            {iban ? (
              <>
                <Text style={kvLabel}>IBAN</Text>
                <Text style={kvValueSmall}>{iban}</Text>
              </>
            ) : null}
            {bic ? (
              <>
                <Text style={kvLabel}>BIC / SWIFT</Text>
                <Text style={kvValueSmall}>{bic}</Text>
              </>
            ) : null}
            <Text style={kvLabel}>Communication</Text>
            <Text style={kvValueSmall}>{paymentReference || invoiceNumber || orderNumber}</Text>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>
            {SITE_NAME} — Marketplace B2B pour les professionnels de santé.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Lien de paiement — Facture ${data?.invoiceNumber || data?.orderNumber || ''}`.trim(),
  displayName: 'Lien de paiement facture (SEPA + IBAN)',
  previewData: {
    customerName: 'Jean Pharmacien',
    vendorName: 'Distrib Pharma',
    invoiceNumber: 'MK-2026-12345',
    orderNumber: 'MK-2026-12345',
    amountIncVat: '1 234,56 EUR',
    dueDate: '15 juillet 2026',
    payUrl: 'https://checkout.stripe.com/c/pay/cs_test_xxx',
    bankName: 'ING Belgique',
    iban: 'BE68 5390 0754 7034',
    bic: 'BBRUBEBB',
    paymentReference: 'MK-2026-12345',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const logo = { margin: '0 0 16px 0' }
const h1 = { color: '#1E252F', fontSize: '22px', fontWeight: 700 as const, margin: '8px 0 16px' }
const h2 = { color: '#1E252F', fontSize: '16px', fontWeight: 700 as const, margin: '20px 0 8px' }
const text = { color: '#1E252F', fontSize: '14px', lineHeight: '22px', margin: '0 0 12px' }
const smallCenter = { color: '#5B6675', fontSize: '12px', textAlign: 'center' as const, margin: '0 0 12px' }
const summaryBox = { backgroundColor: '#F4F6FA', borderRadius: '8px', padding: '16px', margin: '16px 0' }
const bankBox = { backgroundColor: '#FFF7E6', border: '1px solid #F5D48A', borderRadius: '8px', padding: '16px', margin: '12px 0' }
const kvLabel = { color: '#5B6675', fontSize: '12px', margin: '0 0 2px' }
const kvValue = { color: '#1E252F', fontSize: '16px', fontWeight: 700 as const, margin: '0 0 12px' }
const kvValueSmall = { color: '#1E252F', fontSize: '14px', fontWeight: 700 as const, margin: '0 0 10px', fontFamily: 'monospace' }
const button = { backgroundColor: '#1B5BDA', color: '#ffffff', borderRadius: '8px', padding: '12px 22px', fontWeight: 700 as const, textDecoration: 'none', fontSize: '14px' }
const hr = { borderColor: '#E5E7EB', margin: '24px 0' }
const footer = { color: '#8895A4', fontSize: '11px', textAlign: 'center' as const }
