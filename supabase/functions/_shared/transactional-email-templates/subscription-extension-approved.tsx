import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface SubscriptionExtensionApprovedProps {
  pharmacyName?: string
  grantedMonths?: number
  newEndDate?: string
  internalNotes?: string
  ctaUrl?: string
}

const fmtDate = (iso?: string) => {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

const SubscriptionExtensionApprovedEmail = ({
  pharmacyName,
  grantedMonths = 3,
  newEndDate,
  internalNotes,
  ctaUrl = 'https://medikong.pro/espace-pharmacie/abonnement',
}: SubscriptionExtensionApprovedProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre extension de {grantedMonths} mois sur MediKong est accordée</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />

        <Heading style={h1}>✅ Extension accordée</Heading>

        <Text style={text}>
          Bonjour{pharmacyName ? ` ${pharmacyName}` : ''},
        </Text>

        <Text style={text}>
          Bonne nouvelle : votre demande d'extension de la période gratuite MediKong a été
          <strong> acceptée</strong>. Vous continuez à bénéficier de l'accès complet sans frais
          pendant <strong>{grantedMonths} mois supplémentaires</strong>.
        </Text>

        <Section style={infoBox}>
          <Text style={infoLine}><strong>Durée accordée :</strong> {grantedMonths} mois</Text>
          {newEndDate && (
            <Text style={infoLine}><strong>Nouvelle date de fin :</strong> {fmtDate(newEndDate)}</Text>
          )}
        </Section>

        {internalNotes && (
          <Section style={messageBox}>
            <Text style={messageLabel}>Message de l'équipe MediKong</Text>
            <Text style={messageText}>{internalNotes}</Text>
          </Section>
        )}

        <Button href={ctaUrl} style={button}>
          Voir mon abonnement
        </Button>

        <Text style={small}>
          Pendant cette période, profitez-en pour explorer les nouveautés du catalogue, comparer vos
          prix d'achat et activer la veille marché. Notre équipe reste à votre disposition.
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
  component: SubscriptionExtensionApprovedEmail,
  subject: ((data: Record<string, any>) => {
    const m = typeof data.grantedMonths === 'number' ? data.grantedMonths : 3
    return `✅ Votre extension de ${m} mois sur MediKong est accordée`
  }),
  displayName: 'Pharmacien — Extension accordée',
  previewData: {
    pharmacyName: 'Pharmacie Saint-Roch',
    grantedMonths: 3,
    newEndDate: '2026-08-15',
    internalNotes: "Nous prolongeons votre essai pour vous laisser le temps d'atteindre le seuil de volume. Bons achats !",
    ctaUrl: 'https://medikong.pro/espace-pharmacie/abonnement',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = {
  fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px',
  fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
}
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '16px 0 0' }
const infoBox = {
  backgroundColor: '#ecfdf5', borderLeft: '3px solid #059669', borderRadius: '6px',
  padding: '14px 16px', margin: '18px 0',
}
const infoLine = { fontSize: '14px', color: '#065f46', margin: '4px 0', lineHeight: '1.5' }
const messageBox = {
  backgroundColor: '#f1f5f9', borderLeft: '3px solid #1B5BDA', borderRadius: '6px',
  padding: '12px 14px', margin: '14px 0',
}
const messageLabel = { fontSize: '12px', color: '#1B5BDA', fontWeight: '600' as const, margin: '0 0 6px' }
const messageText = { fontSize: '13px', color: '#1D2530', margin: '0', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const }
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
