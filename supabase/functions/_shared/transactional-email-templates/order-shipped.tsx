import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface Props {
  orderNumber?: string
  customerName?: string
  trackingUrl?: string
  trackingCarrier?: string
  trackingNumber?: string
  orderUrl?: string
}

const OrderShippedEmail = ({
  orderNumber = '—',
  customerName,
  trackingUrl,
  trackingCarrier,
  trackingNumber,
  orderUrl,
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre commande {orderNumber} a été expédiée</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />
        <Heading style={h1}>Votre commande a été expédiée</Heading>
        <Text style={text}>Bonjour{customerName ? ` ${customerName}` : ''},</Text>
        <Text style={text}>
          Votre commande <strong>{orderNumber}</strong> vient d'être expédiée.
        </Text>

        {(trackingCarrier || trackingNumber || trackingUrl) && (
          <Section style={trackingBox}>
            <Text style={infoTitle}>Informations de suivi</Text>
            {trackingCarrier && (
              <Text style={infoLine}><strong>Transporteur :</strong> {trackingCarrier}</Text>
            )}
            {trackingNumber && (
              <Text style={infoLine}><strong>N° de suivi :</strong> {trackingNumber}</Text>
            )}
            {trackingUrl && (
              <Section style={{ textAlign: 'center', margin: '18px 0' }}>
                <Button href={trackingUrl} style={btn}>Suivre mon colis →</Button>
              </Section>
            )}
            {!trackingUrl && trackingNumber && (
              <Text style={small}>
                Conservez ce numéro pour suivre votre colis auprès du transporteur.
              </Text>
            )}
          </Section>
        )}

        {orderUrl && (
          <Text style={small}>
            <a href={orderUrl} style={link}>Voir ma commande →</a>
          </Text>
        )}
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
  component: OrderShippedEmail,
  subject: (d: Record<string, any>) =>
    `Votre commande ${d.orderNumber ?? ''} a été expédiée`,
  displayName: 'Commande expédiée (niveau commande)',
  previewData: {
    orderNumber: 'CMD-2026-0001',
    customerName: 'Jean',
    trackingCarrier: 'bpost',
    trackingNumber: '323123456789',
    trackingUrl: 'https://track.bpost.be/btr/web/#/search?itemCode=323123456789',
    orderUrl: 'https://medikong.pro/commande/xxx',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const logo = { margin: '0 0 16px' }
const h1 = { fontSize: '22px', color: '#1E252F', margin: '0 0 12px', fontWeight: 700 }
const text = { fontSize: '14px', lineHeight: '22px', color: '#1E252F', margin: '0 0 12px' }
const small = { fontSize: '12px', color: '#616B7C', margin: '0 0 8px' }
const trackingBox = {
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
  padding: '12px 22px',
  borderRadius: '8px',
  fontSize: '14px',
  fontWeight: 700,
  textDecoration: 'none',
  display: 'inline-block',
}
const link = { color: '#1C58D9', textDecoration: 'underline' }
const divider = { borderColor: '#E2E8F0', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#616B7C', margin: '0' }
const legalFooter = { fontSize: '11px', color: '#8B95A5', margin: '8px 0 0', lineHeight: '16px' }
