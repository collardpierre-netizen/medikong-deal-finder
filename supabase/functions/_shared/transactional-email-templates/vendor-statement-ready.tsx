import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/cms-images/email-logo-horizontal.png'

interface Props {
  vendorName?: string
  periodLabel?: string
  totalNet?: string
  orderCount?: number
  pdfUrl?: string
}

const VendorStatementReadyEmail = ({
  vendorName = 'Fournisseur',
  periodLabel = 'juillet 2026',
  totalNet = '0,00 EUR',
  orderCount = 0,
  pdfUrl = '#',
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre relevé mensuel MediKong — {periodLabel}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>Bonjour {vendorName},</Heading>
        <Text style={text}>
          Votre relevé de compte mensuel pour <strong>{periodLabel}</strong> est disponible.
        </Text>

        <Section style={box}>
          <Text style={boxLabel}>Net transféré sur votre compte</Text>
          <Text style={boxAmount}>{totalNet}</Text>
          <Text style={boxMeta}>{orderCount} commande{orderCount > 1 ? 's' : ''} · {periodLabel}</Text>
        </Section>

        <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
          <Button href={pdfUrl} style={button}>Télécharger le relevé PDF</Button>
        </Section>

        <Text style={smallText}>
          Ce lien est valable 7 jours. Retrouvez tous vos relevés à tout moment dans votre espace
          fournisseur, rubrique Finances.
        </Text>

        <Hr style={divider} />
        <Text style={legalText}>
          Les transferts ont été effectués via Stripe Connect sur le compte bancaire enregistré.
          Ce document est un relevé comptable récapitulatif ; il ne constitue pas une facture et
          n'est pas soumis à la facturation électronique Peppol.
        </Text>

        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: VendorStatementReadyEmail,
  subject: (data: Record<string, any>) =>
    `Votre relevé MediKong — ${data.periodLabel || ''}`.trim(),
  displayName: 'Relevé vendeur mensuel',
  previewData: {
    vendorName: 'Noralphar',
    periodLabel: 'juillet 2026',
    totalNet: '1,21 EUR',
    orderCount: 1,
    pdfUrl: 'https://example.com/releve.pdf',
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
const button = { backgroundColor: '#1B5BDA', color: '#ffffff', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block' }
const divider = { borderColor: '#d1d5db', margin: '24px 0' }
const legalText = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 24px', fontStyle: 'italic' as const }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
