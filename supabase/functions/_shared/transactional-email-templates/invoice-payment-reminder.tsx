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
  orderNumber?: string
  amountIncVat?: string
  dueDate?: string
  daysOffset?: number // negative = days before due, positive = days overdue
  payUrl?: string
}

const Email = ({
  customerName,
  vendorName = 'votre fournisseur',
  orderNumber = 'MK-2026-00000',
  amountIncVat = '0,00 EUR',
  dueDate = '',
  daysOffset = 0,
  payUrl = 'https://medikong.pro/account/orders',
}: Props) => {
  const overdue = daysOffset > 0
  const title = overdue
    ? `Facture en retard de ${daysOffset} jour${daysOffset > 1 ? 's' : ''}`
    : daysOffset === 0
      ? 'Votre facture arrive à échéance aujourd\'hui'
      : `Votre facture arrive à échéance dans ${Math.abs(daysOffset)} jour${Math.abs(daysOffset) > 1 ? 's' : ''}`
  const preview = `${title} — Commande ${orderNumber}`
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />
          <Heading style={h1}>{overdue ? '⚠️ ' : '🔔 '}{title}</Heading>
          <Text style={text}>Bonjour{customerName ? ` ${customerName}` : ''},</Text>
          <Text style={text}>
            Cet email est un rappel concernant la facture émise par <strong>{vendorName}</strong> pour
            votre commande <strong>{orderNumber}</strong>.
          </Text>
          <Section style={summaryBox}>
            <Text style={kvLabel}>Montant TTC</Text>
            <Text style={kvValue}>{amountIncVat}</Text>
            <Text style={kvLabel}>Échéance</Text>
            <Text style={kvValue}>{dueDate}</Text>
          </Section>
          <Text style={text}>
            {overdue
              ? 'Merci de procéder au règlement sans délai pour éviter toute interruption de service.'
              : 'Merci de veiller à ce que le règlement soit effectué avant la date d\'échéance.'}
          </Text>
          <Section style={{ textAlign: 'center', margin: '24px 0' }}>
            <Button href={payUrl} style={button}>Voir la commande</Button>
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
  subject: (data: Record<string, any>) => {
    const n = data?.daysOffset ?? 0
    if (n > 0) return `Facture en retard — Commande ${data?.orderNumber || ''}`
    if (n === 0) return `Échéance facture aujourd'hui — Commande ${data?.orderNumber || ''}`
    return `Rappel facture — Commande ${data?.orderNumber || ''}`
  },
  displayName: 'Relance facture (paiement vendeur)',
  previewData: {
    customerName: 'Jean Pharmacien',
    vendorName: 'Distrib Pharma',
    orderNumber: 'MK-2026-12345',
    amountIncVat: '1 234,56 EUR',
    dueDate: '15 juillet 2026',
    daysOffset: 3,
    payUrl: 'https://medikong.pro/account/orders',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px' }
const logo = { margin: '0 0 16px 0' }
const h1 = { color: '#1E252F', fontSize: '22px', fontWeight: 700 as const, margin: '8px 0 16px' }
const text = { color: '#1E252F', fontSize: '14px', lineHeight: '22px', margin: '0 0 12px' }
const summaryBox = { backgroundColor: '#F4F6FA', borderRadius: '8px', padding: '16px', margin: '16px 0' }
const kvLabel = { color: '#5B6675', fontSize: '12px', margin: '0 0 2px' }
const kvValue = { color: '#1E252F', fontSize: '16px', fontWeight: 700 as const, margin: '0 0 12px' }
const button = { backgroundColor: '#1B5BDA', color: '#ffffff', borderRadius: '8px', padding: '12px 22px', fontWeight: 700 as const, textDecoration: 'none', fontSize: '14px' }
const hr = { borderColor: '#E5E7EB', margin: '24px 0' }
const footer = { color: '#8895A4', fontSize: '11px', textAlign: 'center' as const }
