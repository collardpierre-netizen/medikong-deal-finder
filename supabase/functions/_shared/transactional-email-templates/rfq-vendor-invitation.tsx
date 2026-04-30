import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Section, Row, Column,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface RfqVendorInvitationProps {
  vendorName?: string
  productName?: string | null
  brandName?: string | null
  quantity?: number | null
  targetPriceCents?: number | null
  countryCode?: string | null
  deadline?: string | null
  desiredDeliveryDate?: string | null
  paymentTerms?: string | null
  offerValidityDays?: number | null
  comment?: string | null
  targetReason?: string | null
  targetReasonLabel?: string | null
  rfqUrl?: string
  trackingPixelUrl?: string
}

const formatEUR = (cents?: number | null) => {
  if (cents == null || isNaN(cents)) return null
  return new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

const formatDate = (s?: string | null) => {
  if (!s) return null
  try {
    return new Date(s).toLocaleDateString('fr-BE', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return s }
}

const COUNTRY_NAMES: Record<string, string> = { BE: 'Belgique', FR: 'France', LU: 'Luxembourg', NL: 'Pays-Bas', DE: 'Allemagne' }

const RfqVendorInvitationEmail = ({
  vendorName, productName, brandName, quantity, targetPriceCents,
  countryCode, deadline, desiredDeliveryDate, paymentTerms, offerValidityDays, comment,
  targetReasonLabel,
  rfqUrl, trackingPixelUrl,
}: RfqVendorInvitationProps) => {
  const productLabel = productName ?? brandName ?? 'un produit de votre catalogue'
  const target = formatEUR(targetPriceCents)
  const deadlineFmt = formatDate(deadline)
  const deliveryFmt = formatDate(desiredDeliveryDate)
  const country = countryCode ? (COUNTRY_NAMES[countryCode] ?? countryCode) : null

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Nouvelle demande de prix sur {SITE_NAME} — {productLabel}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
          <Heading style={h1}>Nouvelle demande de prix</Heading>
          <Text style={text}>
            Bonjour{vendorName ? ` ${vendorName}` : ''}, un acheteur vérifié vous sollicite pour <strong>{productLabel}</strong>{brandName && productName ? ` (${brandName})` : ''}.
          </Text>

          <Section style={card}>
            <Heading as="h2" style={h2}>Récapitulatif de la demande</Heading>
            <Row style={kvRow}>
              <Column style={kvKey}>Produit</Column>
              <Column style={kvVal}>{productLabel}{brandName && productName ? ` — ${brandName}` : ''}</Column>
            </Row>
            {quantity != null && (
              <Row style={kvRow}>
                <Column style={kvKey}>Quantité</Column>
                <Column style={kvVal}><strong>{quantity.toLocaleString('fr-BE')}</strong> unités</Column>
              </Row>
            )}
            {target && (
              <Row style={kvRow}>
                <Column style={kvKey}>Prix cible (HTVA)</Column>
                <Column style={kvVal}><strong>{target}</strong> / unité</Column>
              </Row>
            )}
            {country && (
              <Row style={kvRow}>
                <Column style={kvKey}>Destination</Column>
                <Column style={kvVal}>{country}</Column>
              </Row>
            )}
            {deliveryFmt && (
              <Row style={kvRow}>
                <Column style={kvKey}>Livraison souhaitée</Column>
                <Column style={kvVal}>{deliveryFmt}</Column>
              </Row>
            )}
            {paymentTerms && (
              <Row style={kvRow}>
                <Column style={kvKey}>Conditions de paiement</Column>
                <Column style={kvVal}>{paymentTerms}</Column>
              </Row>
            )}
            {offerValidityDays != null && (
              <Row style={kvRow}>
                <Column style={kvKey}>Validité offre demandée</Column>
                <Column style={kvVal}>{offerValidityDays} jours</Column>
              </Row>
            )}
            {deadlineFmt && (
              <Row style={kvRow}>
                <Column style={kvKey}>⏱ Répondre avant le</Column>
                <Column style={{ ...kvVal, color: '#b91c1c', fontWeight: 600 }}>{deadlineFmt}</Column>
              </Row>
            )}
          </Section>

          {comment && (
            <Section style={commentBox}>
              <Text style={commentLabel}>Note de l'acheteur</Text>
              <Text style={commentText}>{comment}</Text>
            </Section>
          )}

          <Text style={text}>
            Cliquez ci-dessous pour consulter la demande complète et envoyer votre offre (prix, MOQ, délai, validité) :
          </Text>
          <Button href={rfqUrl} style={button}>
            Répondre à la demande
          </Button>
          <Text style={smallLink}>
            Ou copiez ce lien : <br />
            <span style={{ wordBreak: 'break-all', color: '#1C58D9' }}>{rfqUrl}</span>
          </Text>

          <Hr style={divider} />
          <Text style={footerText}>
            Une réponse rapide augmente vos chances d'être retenu. Si vous ne pouvez pas répondre, indiquez-le directement depuis le portail (cela évite les relances automatiques).
          </Text>
          <Text style={footer}>L'équipe {SITE_NAME}</Text>
          {trackingPixelUrl && <Img src={trackingPixelUrl} width="1" height="1" alt="" style={{ display: 'none' }} />}
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: RfqVendorInvitationEmail,
  subject: (data: Record<string, any>) => {
    const label = data?.productName || data?.brandName || 'un produit'
    const qty = data?.quantity ? ` (${data.quantity} u.)` : ''
    return `📩 Nouvelle demande de prix — ${label}${qty}`
  },
  displayName: 'RFQ — Invitation vendeur',
  previewData: {
    vendorName: 'PharmaCorp',
    productName: 'Doliprane 1000mg',
    brandName: 'Sanofi',
    quantity: 500,
    targetPriceCents: 245,
    countryCode: 'BE',
    deadline: '2026-05-10T12:00:00Z',
    desiredDeliveryDate: '2026-05-20',
    paymentTerms: '30 jours fin de mois',
    offerValidityDays: 14,
    comment: 'Commande récurrente possible si prix compétitif.',
    rfqUrl: 'https://medikong-deal-finder.lovable.app/vendor/rfq/abc?t=xyz',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#1E252F', margin: '0 0 16px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const h2 = { fontSize: '16px', fontWeight: 600 as const, color: '#1E252F', margin: '0 0 12px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '20px', margin: '20px 0' }
const kvRow = { padding: '6px 0', borderBottom: '1px solid #EDF1F7' }
const kvKey = { fontSize: '13px', color: '#6b7280', width: '45%', verticalAlign: 'top' as const }
const kvVal = { fontSize: '14px', color: '#1E252F', verticalAlign: 'top' as const }
const commentBox = { backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '14px 16px', margin: '16px 0' }
const commentLabel = { fontSize: '12px', color: '#92400E', fontWeight: 600 as const, margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }
const commentText = { fontSize: '14px', color: '#451a03', lineHeight: '1.5', margin: 0, whiteSpace: 'pre-wrap' as const }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '14px 28px', fontSize: '14px', fontWeight: 600 as const, textDecoration: 'none', display: 'inline-block', margin: '8px 0 16px' }
const smallLink = { fontSize: '12px', color: '#6b7280', margin: '0 0 16px', lineHeight: '1.5' }
const divider = { borderColor: '#E2E8F0', margin: '24px 0 16px' }
const footerText = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px', lineHeight: '1.5' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
