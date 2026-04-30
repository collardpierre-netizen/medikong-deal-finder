import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface VendorPriceChallengeProps {
  vendorName?: string
  productName?: string
  cnk?: string | null
  mkPriceHt?: number
  refPriceHt?: number
  refLabel?: string
  deltaPct?: number
  suggestedPriceHt?: number
  reason?: 'vs_external' | 'vs_internal' | 'vs_pvp' | 'negative_margin' | 'no_offer'
  message?: string
  ctaUrl?: string
}

const REASON_LABEL: Record<NonNullable<VendorPriceChallengeProps['reason']>, string> = {
  vs_external: 'Écart vs marché externe',
  vs_internal: 'Écart vs autre vendeur MediKong',
  vs_pvp: 'Écart vs prix public conseillé',
  negative_margin: 'Marge négative',
  no_offer: 'Aucune offre active',
}

const fmtEur = (v?: number) => (typeof v === 'number' ? `${v.toFixed(2)} €` : '—')

const VendorPriceChallengeEmail = ({
  vendorName,
  productName = 'votre produit',
  cnk,
  mkPriceHt,
  refPriceHt,
  refLabel = 'le marché',
  deltaPct,
  suggestedPriceHt,
  reason = 'vs_external',
  message,
  ctaUrl,
}: VendorPriceChallengeProps) => {
  const deltaTxt =
    typeof deltaPct === 'number'
      ? `${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%`
      : '—'

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Votre prix est {deltaTxt} au-dessus du marché sur {productName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />

          <Heading style={h1}>📊 Opportunité d'ajustement de prix</Heading>

          <Text style={text}>
            Bonjour{vendorName ? ` ${vendorName}` : ''},
          </Text>

          <Text style={text}>
            Sur le produit <strong>« {productName} »</strong>{cnk ? ` (CNK ${cnk})` : ''}, votre prix
            est actuellement plus élevé que la meilleure référence relevée par notre veille marché.
          </Text>

          <Section style={infoBox}>
            <Text style={infoLine}><strong>Produit :</strong> {productName}</Text>
            {cnk ? <Text style={infoLine}><strong>CNK :</strong> {cnk}</Text> : null}
            <Text style={infoLine}><strong>Motif :</strong> {REASON_LABEL[reason]}</Text>
            <Text style={infoLine}><strong>Votre prix HTVA :</strong> {fmtEur(mkPriceHt)}</Text>
            <Text style={infoLine}>
              <strong>Référence ({refLabel}) :</strong> {fmtEur(refPriceHt)}
            </Text>
            <Text style={infoLineHighlight}>
              <strong>Écart :</strong> {deltaTxt}
            </Text>
          </Section>

          {typeof suggestedPriceHt === 'number' && (
            <Section style={suggestionBox}>
              <Text style={suggestionLabel}>💡 Prix suggéré pour reprendre la 1<sup>re</sup> position</Text>
              <Text style={suggestionPrice}>{fmtEur(suggestedPriceHt)} HTVA</Text>
              <Text style={suggestionHelp}>
                Aligner votre offre 1 % sous la référence vous repositionne en tête des résultats acheteurs.
              </Text>
            </Section>
          )}

          {message && (
            <Section style={messageBox}>
              <Text style={messageText}>{message}</Text>
            </Section>
          )}

          {ctaUrl ? (
            <Button href={ctaUrl} style={button}>
              Ajuster mon offre
            </Button>
          ) : null}

          <Text style={small}>
            Cette notification est aussi disponible dans votre espace vendeur MediKong, onglet « Notifications ».
            Aucune action n'est obligatoire — il s'agit d'une recommandation pour maximiser votre visibilité.
          </Text>

          <Hr style={divider} />

          <Text style={footerText}>
            Une question ? Répondez à cet email ou contactez{' '}
            <a href="mailto:vendeurs@medikong.pro" style={link}>vendeurs@medikong.pro</a>.
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
}

export const template = {
  component: VendorPriceChallengeEmail,
  subject: ((data: Record<string, any>) => {
    const product = data.productName || 'un produit'
    if (typeof data.deltaPct === 'number') {
      const pct = `${data.deltaPct > 0 ? '+' : ''}${data.deltaPct.toFixed(1)}%`
      return `📊 Votre prix est ${pct} au-dessus du marché sur ${product}`
    }
    return `📊 Opportunité d'ajustement de prix sur ${product}`
  }),
  displayName: 'Vendeur — Challenge prix (admin → vendeur)',
  previewData: {
    vendorName: 'PharmaCorp',
    productName: 'Doliprane 1000 mg, boîte de 8',
    cnk: '0123456',
    mkPriceHt: 4.85,
    refPriceHt: 4.20,
    refLabel: 'Medi-Market',
    deltaPct: 15.5,
    suggestedPriceHt: 4.16,
    reason: 'vs_external',
    message: "Vous êtes très proche du leader, un petit ajustement vous remet en pole position.",
    ctaUrl: 'https://medikong.pro/vendor/offers',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = {
  fontSize: '24px',
  fontWeight: '700' as const,
  color: '#1e3a5f',
  margin: '0 0 20px',
  fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
}
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const small = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '16px 0 0' }
const infoBox = {
  backgroundColor: '#f1f5f9',
  borderLeft: '3px solid #1B5BDA',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '18px 0',
}
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }
const infoLineHighlight = { fontSize: '14px', color: '#dc2626', margin: '8px 0 0', lineHeight: '1.5', fontWeight: '600' as const }
const suggestionBox = {
  backgroundColor: '#ecfdf5',
  borderLeft: '3px solid #059669',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '14px 0',
}
const suggestionLabel = { fontSize: '12px', color: '#065f46', margin: '0 0 6px', lineHeight: '1.4' }
const suggestionPrice = { fontSize: '20px', color: '#065f46', fontWeight: '700' as const, margin: '0 0 6px' }
const suggestionHelp = { fontSize: '12px', color: '#047857', margin: '0', lineHeight: '1.5' }
const messageBox = {
  backgroundColor: '#fffbeb',
  borderLeft: '3px solid #f59e0b',
  borderRadius: '6px',
  padding: '12px 14px',
  margin: '14px 0',
}
const messageText = { fontSize: '13px', color: '#1D2530', margin: '0', lineHeight: '1.6', whiteSpace: 'pre-wrap' as const }
const button = {
  backgroundColor: '#1B5BDA',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '14px 32px',
  fontSize: '14px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  display: 'inline-block',
  marginTop: '8px',
  marginBottom: '8px',
}
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px', lineHeight: '1.5' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
const link = { color: '#1B5BDA', textDecoration: 'none' }
