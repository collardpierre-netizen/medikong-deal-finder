import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface WholesaleSavingsReportProps {
  pharmacyName?: string
  supplierLabel?: string
  totalLines?: number
  matchedLines?: number
  matchRatePct?: number
  sourceTotal?: string
  medikongTotal?: string
  savingsAmount?: string
  savingsPct?: number
  reportUrl?: string
  signupUrl?: string
  deleteUrl?: string
  expiresInDays?: number
}

const fmtPct = (n?: number) => (typeof n === 'number' ? `${n.toFixed(1)} %` : '—')

const WholesaleSavingsReportEmail = ({
  pharmacyName = 'votre pharmacie',
  supplierLabel = 'votre grossiste',
  totalLines = 0,
  matchedLines = 0,
  matchRatePct = 0,
  sourceTotal = '0,00 €',
  medikongTotal = '0,00 €',
  savingsAmount = '0,00 €',
  savingsPct = 0,
  reportUrl = 'https://medikong.pro',
  signupUrl = 'https://medikong.pro/onboarding',
  deleteUrl = 'https://medikong.pro',
  expiresInDays = 30,
}: WholesaleSavingsReportProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre rapport d'économies {SITE_NAME} : {savingsAmount} potentiels</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={{ marginBottom: '24px' }} />

        <Heading style={h1}>Votre rapport d'économies est prêt</Heading>
        <Text style={text}>
          Bonjour,<br />
          Voici l'analyse de votre dernier bon de commande {supplierLabel} pour {pharmacyName}.
        </Text>

        <Section style={heroBox}>
          <Text style={heroLabel}>Économies potentielles annualisées</Text>
          <Text style={heroAmount}>{savingsAmount}</Text>
          <Text style={heroSub}>soit {fmtPct(savingsPct)} de votre facture grossiste</Text>
        </Section>

        <Section style={summaryBox}>
          <Text style={summaryRow}><span style={summaryK}>Lignes analysées</span><span style={summaryV}>{matchedLines} / {totalLines} ({fmtPct(matchRatePct)})</span></Text>
          <Text style={summaryRow}><span style={summaryK}>Total {supplierLabel}</span><span style={summaryV}>{sourceTotal}</span></Text>
          <Text style={summaryRow}><span style={summaryK}>Total {SITE_NAME}</span><span style={summaryV}>{medikongTotal}</span></Text>
          <Text style={{ ...summaryRow, borderTop: '1px solid #d1d5db', paddingTop: '8px', marginTop: '8px' }}>
            <span style={{ ...summaryK, fontWeight: 700 }}>Économie</span>
            <span style={{ ...summaryV, color: '#16a34a', fontWeight: 700 }}>{savingsAmount}</span>
          </Text>
        </Section>

        <Section style={{ textAlign: 'center', margin: '0 0 12px' }}>
          <Button href={reportUrl} style={primaryButton}>
            Télécharger le rapport PDF
          </Button>
        </Section>
        <Text style={muted}>
          Ce lien est valable {expiresInDays} jours et ne doit pas être partagé : il contient des informations sensibles sur votre activité.
        </Text>

        <Hr style={divider} />

        <Heading style={h2}>Et maintenant ?</Heading>
        <Text style={text}>
          Créez votre compte {SITE_NAME} pour commander aux prix de votre rapport, recevoir des alertes prix et garder un historique de vos simulations.
        </Text>
        <Section style={{ textAlign: 'center', margin: '0 0 24px' }}>
          <Button href={signupUrl} style={secondaryButton}>
            Créer mon compte
          </Button>
        </Section>

        <Hr style={divider} />

        <Text style={legal}>
          Email transactionnel envoyé suite à votre demande de simulation. Vous pouvez supprimer définitivement votre simulation et toutes les données associées via ce lien :{' '}
          <a href={deleteUrl} style={legalLink}>supprimer ma simulation</a>.
        </Text>
        <Text style={footer}>{SITE_NAME} — Balooh SRL · 23 rue de la Procession · 7822 Ath · Belgique</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WholesaleSavingsReportEmail,
  subject: (data: Record<string, any>) =>
    `Votre rapport d'économies ${SITE_NAME} : ${data.savingsAmount ?? '—'} économisables`,
  displayName: 'Rapport économies grossiste',
  previewData: {
    pharmacyName: 'Pharmacie du Centre',
    supplierLabel: 'Febelco',
    totalLines: 124,
    matchedLines: 108,
    matchRatePct: 87.1,
    sourceTotal: '12 480,30 €',
    medikongTotal: '10 920,15 €',
    savingsAmount: '1 560,15 €',
    savingsPct: 12.5,
    reportUrl: 'https://medikong.pro/r/savings/example.pdf',
    signupUrl: 'https://medikong.pro/onboarding?ref=savings-example',
    deleteUrl: 'https://medikong.pro/economies/supprimer/example',
    expiresInDays: 30,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '600px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 12px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const h2 = { fontSize: '18px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 20px' }
const muted = { fontSize: '12px', color: '#6b7280', textAlign: 'center' as const, margin: '0 0 24px' }
const heroBox = { backgroundColor: '#1c58d9', borderRadius: '12px', padding: '24px', margin: '0 0 16px', textAlign: 'center' as const }
const heroLabel = { fontSize: '13px', color: '#dbeafe', margin: '0 0 4px', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const heroAmount = { fontSize: '36px', color: '#ffffff', fontWeight: '700' as const, margin: '0 0 4px', lineHeight: '1' }
const heroSub = { fontSize: '13px', color: '#dbeafe', margin: '0' }
const summaryBox = { backgroundColor: '#f8f9fb', borderRadius: '8px', padding: '16px', border: '1px solid #d1d5db', margin: '0 0 24px' }
const summaryRow = { display: 'flex', justifyContent: 'space-between', fontSize: '13px', margin: '0', padding: '6px 0' }
const summaryK = { color: '#6b7280' }
const summaryV = { color: '#1e3a5f', fontWeight: 600 as const }
const primaryButton = { backgroundColor: '#1c58d9', color: '#ffffff', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block' }
const secondaryButton = { backgroundColor: '#ffffff', color: '#1e3a5f', borderRadius: '8px', padding: '11px 27px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', border: '1px solid #1e3a5f' }
const divider = { borderColor: '#e5e7eb', margin: '24px 0' }
const legal = { fontSize: '11px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 12px' }
const legalLink = { color: '#1c58d9', textDecoration: 'underline' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0', textAlign: 'center' as const }
