import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface Props {
  documentNumber?: string
  orderNumber?: string
  customerName?: string
  confirmUrl?: string
  lineCount?: number
}

const DeliveryConfirmationRequestEmail = ({
  documentNumber = '—',
  orderNumber = '—',
  customerName,
  confirmUrl,
  lineCount,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Signez la réception du bon de livraison {documentNumber}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />
        <Heading style={h1}>Signez votre bon de livraison</Heading>
        <Text style={text}>Bonjour{customerName ? ` ${customerName}` : ''},</Text>
        <Text style={text}>
          Le bon de livraison <strong>{documentNumber}</strong> de la commande{' '}
          <strong>{orderNumber}</strong>
          {typeof lineCount === 'number' && lineCount > 0
            ? ` (${lineCount} ligne${lineCount > 1 ? 's' : ''})`
            : ''}{' '}
          attend votre validation.
        </Text>

        <Section style={box}>
          <Text style={infoTitle}>En ligne, en 2 minutes :</Text>
          <Text style={infoLine}>✓ Cochez la checklist de réception</Text>
          <Text style={infoLine}>✓ Indiquez les quantités réellement reçues</Text>
          <Text style={infoLine}>✓ Signez et ajoutez vos remarques</Text>
        </Section>

        {Array.isArray(checklistItems) && checklistItems.length > 0 && (
          <Section style={box}>
            <Text style={infoTitle}>Checklist de réception à contrôler :</Text>
            {checklistItems.map((label, i) => (
              <Text key={i} style={infoLine}>☐ {label}</Text>
            ))}
          </Section>
        )}

        {confirmUrl && (
          <Section style={{ textAlign: 'center', margin: '22px 0' }}>
            <Button href={confirmUrl} style={btn}>Signer la réception →</Button>
          </Section>
        )}

        <Text style={small}>
          Votre signature est horodatée et conservée avec le bon de livraison. Ce lien est
          personnel, ne le partagez pas.
        </Text>

        <Hr style={divider} />
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
        <Text style={legalFooter}>
          MediKong SRL · TVA : BE 1005.771.323<br />
          23 rue de la Procession, B-7822 Meslin-l'Évêque, Belgique
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DeliveryConfirmationRequestEmail,
  subject: (d: Record<string, any>) =>
    `Signez la réception du bon de livraison ${d.documentNumber ?? ''}`,
  displayName: 'Signature du bon de livraison (client)',
  previewData: {
    documentNumber: 'BL-2026-0001',
    orderNumber: 'MK-2026-20064',
    customerName: 'Pharmacie Centrale',
    confirmUrl: 'https://medikong.pro/livraison/abcdef1234567890',
    lineCount: 4,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const logo = { margin: '0 0 16px' }
const h1 = { fontSize: '22px', color: '#1E252F', margin: '0 0 12px', fontWeight: 700 }
const text = { fontSize: '14px', lineHeight: '22px', color: '#1E252F', margin: '0 0 12px' }
const small = { fontSize: '12px', color: '#616B7C', margin: '12px 0 0' }
const box = {
  backgroundColor: '#F1F5F9',
  borderRadius: '10px',
  padding: '16px 18px',
  margin: '16px 0',
}
const infoTitle = { fontSize: '13px', color: '#616B7C', margin: '0 0 8px', fontWeight: 700, textTransform: 'uppercase' as const }
const infoLine = { fontSize: '14px', color: '#1E252F', margin: '2px 0' }
const btn = {
  backgroundColor: '#1C58D9',
  color: '#ffffff',
  padding: '14px 26px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'inline-block',
}
const divider = { borderColor: '#E2E8F0', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#616B7C', margin: '0' }
const legalFooter = { fontSize: '11px', color: '#8B95A5', margin: '8px 0 0', lineHeight: '16px' }
