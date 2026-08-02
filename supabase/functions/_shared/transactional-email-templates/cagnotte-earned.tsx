import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface CagnotteEarnedProps {
  pharmacien_prenom?: string
  order_number?: string
  order_ht?: number
  eligible_ht?: number
  cagnotte_earned?: number
  cagnotte_balance_total?: number
  expires_on?: string
  cta_url?: string
}

const eur = (v?: number) => `${Number(v ?? 0).toFixed(2).replace('.', ',')} €`

const CagnotteEarnedEmail = ({
  pharmacien_prenom, order_number, order_ht, eligible_ht,
  cagnotte_earned, cagnotte_balance_total, expires_on, cta_url,
}: CagnotteEarnedProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>
      Commande {order_number} confirmée · +{eur(cagnotte_earned)} de cagnotte
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={{ marginBottom: '24px' }} />
        <Heading style={h1}>
          Merci{pharmacien_prenom ? `, ${pharmacien_prenom}` : ''} !
        </Heading>
        <Text style={text}>
          Votre commande <strong>{order_number}</strong> ({eur(order_ht)} HT) est confirmée.
        </Text>

        <Section style={callout}>
          <Text style={calloutAmount}>+ {eur(cagnotte_earned)}</Text>
          <Text style={calloutSub}>gagné sur {eur(eligible_ht)} HT éligibles</Text>
        </Section>

        <Section style={balanceBox}>
          <Text style={balanceMain}>Votre solde total : {eur(cagnotte_balance_total)}</Text>
          <Text style={balanceSub}>Utilisable jusqu'au {expires_on}</Text>
        </Section>

        <Button href={cta_url} style={button}>Voir ma cagnotte</Button>

        <Hr style={divider} />
        <Text style={footerText}>
          La cagnotte {SITE_NAME} est utilisable dès 0,50 € de solde, dans la limite de 30 % du
          sous-total HT de votre commande.
        </Text>
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CagnotteEarnedEmail,
  subject: (d: Record<string, any>) =>
    `✅ Commande ${d.order_number ?? ''} confirmée · +${Number(d.cagnotte_earned ?? 0).toFixed(2).replace('.', ',')} € de cagnotte`,
  displayName: 'Cagnotte gagnée',
  previewData: {
    pharmacien_prenom: 'Julie',
    order_number: 'MK-2026-00042',
    order_ht: 1500,
    eligible_ht: 1000,
    cagnotte_earned: 20,
    cagnotte_balance_total: 487.2,
    expires_on: '31 décembre 2027',
    cta_url: 'https://www.medikong.pro/compte',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const callout = { background: 'linear-gradient(135deg, #0D5F5A 0%, #14847D 100%)', borderRadius: '12px', padding: '24px', textAlign: 'center' as const, margin: '0 0 20px' }
const calloutAmount = { fontSize: '40px', fontWeight: '700' as const, color: '#ffffff', margin: '0' }
const calloutSub = { fontSize: '14px', color: 'rgba(255,255,255,0.85)', margin: '6px 0 0' }
const balanceBox = { background: 'rgba(244,185,66,0.12)', border: '1px solid rgba(244,185,66,0.35)', borderRadius: '10px', padding: '14px 16px', margin: '0 0 24px' }
const balanceMain = { fontSize: '15px', fontWeight: '600' as const, color: '#1e3a5f', margin: '0' }
const balanceSub = { fontSize: '13px', color: '#6b7280', margin: '4px 0 0' }
const button = { backgroundColor: '#F4B942', color: '#3D2A00', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
