import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface SavingsAnalysisFailedProps {
  pharmacyName?: string
  reason?: 'timeout' | 'pipeline_error' | 'no_match' | string
  retryUrl?: string
}

const REASON_TEXT: Record<string, string> = {
  timeout: "Le traitement de votre bon de commande a dépassé le délai maximal et a été interrompu. Cela arrive généralement avec des documents très longs ou des scans peu lisibles.",
  pipeline_error: "Une erreur technique est survenue pendant l'analyse de votre bon de commande.",
  no_match: "Nous n'avons pas pu rattacher les lignes de votre bon de commande à notre catalogue. Le document est peut-être illisible ou dans un format inattendu.",
}

const SavingsAnalysisFailedEmail = ({
  pharmacyName = 'votre pharmacie',
  reason = 'pipeline_error',
  retryUrl = 'https://medikong.pro/economies',
}: SavingsAnalysisFailedProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre analyse d'économies MediKong n'a pas pu aboutir</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
        <Heading style={h1}>Votre analyse n'a pas pu aboutir</Heading>
        <Text style={text}>
          Nous avons bien reçu le bon de commande de <strong>{pharmacyName}</strong>,
          mais l'analyse n'a pas pu être finalisée.
        </Text>
        <Text style={warn}>{REASON_TEXT[reason] ?? REASON_TEXT.pipeline_error}</Text>
        <Text style={text}>
          Vous pouvez relancer une analyse avec un document plus net (PDF texte de
          préférence, ou export CSV de votre grossiste).
        </Text>
        <Button href={retryUrl} style={button}>
          Relancer une analyse
        </Button>
        <Hr style={divider} />
        <Text style={footer}>
          Besoin d'aide ? Répondez à cet email ou écrivez-nous à pcoll@medikong.pro<br />
          {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SavingsAnalysisFailedEmail,
  subject: (data: Record<string, any>) =>
    `Votre analyse d'économies n'a pas pu aboutir${data.pharmacyName ? ` — ${data.pharmacyName}` : ''}`,
  displayName: 'Économies — analyse échouée',
  previewData: {
    pharmacyName: 'Pharmacie Centrale',
    reason: 'timeout',
    retryUrl: 'https://medikong.pro/economies',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px', fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif" }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const warn = { fontSize: '14px', color: '#92400E', backgroundColor: '#FFFBEB', padding: '12px 16px', borderRadius: '8px', margin: '0 0 20px', border: '1px solid #FDE68A', lineHeight: '1.6' }
const button = { backgroundColor: '#1e3a5f', color: '#ffffff', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block' }
const divider = { borderColor: '#d1d5db', margin: '24px 0 16px' }
const footer = { fontSize: '12px', color: '#9ca3af', margin: '0', lineHeight: '1.5' }
