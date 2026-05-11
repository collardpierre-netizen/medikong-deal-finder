import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface SubscriptionExtensionRejectedProps {
  pharmacyName?: string
  rejectionReason?: string
  switchDate?: string
  ctaUrl?: string
}

const fmtDate = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

const SubscriptionExtensionRejectedEmail = ({
  pharmacyName,
  rejectionReason,
  switchDate,
  ctaUrl = 'https://medikong.pro/espace-pharmacie/abonnement',
}: SubscriptionExtensionRejectedProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Réponse à votre demande d'extension MediKong</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />

        <Heading style={h1}>Réponse à votre demande d'extension</Heading>

        <Text style={text}>
          Bonjour{pharmacyName ? ` ${pharmacyName}` : ''},
        </Text>

        <Text style={text}>
          Nous avons étudié attentivement votre demande de prolongation de la période gratuite
          MediKong. Après analyse, nous ne sommes pas en mesure d'accorder cette extension
          aujourd'hui.
        </Text>

        {rejectionReason && (
          <Section style={reasonBox}>
            <Text style={reasonLabel}>Motif</Text>
            <Text style={reasonText}>{rejectionReason}</Text>
          </Section>
        )}

        {switchDate && (
          <Text style={text}>
            Votre abonnement basculera en formule payante le <strong>{fmtDate(switchDate)}</strong>.
            Vous conservez d'ici là un accès complet à la plateforme.
          </Text>
        )}

        <Button href={ctaUrl} style={button}>
          Voir mon abonnement
        </Button>

        <Text style={small}>
          Vous pouvez à tout moment échanger avec notre équipe commerciale pour étudier une autre
          option : aménagement de paiement, accompagnement personnalisé, ou nouvelle demande dans
          quelques mois si vos volumes évoluent.
        </Text>

        <Hr style={divider} />

        <Text style={footerText}>
          Une question ? Répondez à cet email ou contactez{' '}
          <a href="mailto:pharmaciens@medikong.pro" style={link}>pharmaciens@medikong.pro</a>.
        </Text>
        <Text style={footer}>L'équipe {SITE_NAME}</Text>
        <Text style={legalFooter}>
          MediKong by Balooh SRL · TVA : BE 1005.771.323<br />
          23 rue de la Procession, B-7822 Ath, Belgique
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionExtensionRejectedEmail,
  subject: 'Réponse à votre demande d\'extension MediKong',
  displayName: 'Pharmacien — Extension refusée',
  previewData: {
    pharmacyName: 'Pharmacie Saint-Roch',
    rejectionReason: "Votre volume cumulé reste trop éloigné du seuil de prolongation. Nous reverrons votre situation au prochain palier.",
    switchDate: '2026-06-01',
    ctaUrl: 'https://medikong.pro/espace-pharmacie/abonnement',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = {
  fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px',
  fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
}
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '16px 0 0' }
const reasonBox = {
  backgroundColor: '#fef2f2', borderLeft: '3px solid #dc2626', borderRadius: '6px',
  padding: '12px 14px', margin: '14px 0',
}
const reasonLabel = { fontSize: '12px', color: '#991b1b', fontWeight: '600' as const, margin: '0 0 6px' }
const reasonText = { fontSize: '13px', color: '#1D2530', margin: '0', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const }
const button = {
  backgroundColor: '#1B5BDA', color: '#ffffff', borderRadius: '8px', padding: '14px 32px',
  fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block',
  marginTop: '8px', marginBottom: '8px',
}
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px', lineHeight: '1.5' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
const link = { color: '#1B5BDA', textDecoration: 'none' }
