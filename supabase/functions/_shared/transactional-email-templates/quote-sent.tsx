import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Button, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  quoteNumber: string
  vendorName?: string
  customerName?: string
  totalTtcEur?: string
  validUntil?: string
  publicUrl: string
  pdfUrl?: string
  messageCustomer?: string
}

const QuoteSentEmail = ({
  quoteNumber,
  vendorName,
  customerName,
  totalTtcEur,
  validUntil,
  publicUrl,
  pdfUrl,
  messageCustomer,
}: Props) => (
  <Html lang="fr">
    <Head />
    <Preview>Votre devis {quoteNumber} de {vendorName ?? 'MediKong'} est disponible</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Votre devis est prêt</Heading>
        <Text style={text}>
          {customerName ? `Bonjour ${customerName},` : 'Bonjour,'}
        </Text>
        <Text style={text}>
          {vendorName ?? 'MediKong'} vous a établi un devis personnalisé{validUntil ? `, valable jusqu'au ${validUntil}` : ''}.
        </Text>

        <Section style={card}>
          <Text style={cardLabel}>Référence</Text>
          <Text style={cardValue}>{quoteNumber}</Text>
          {totalTtcEur && (
            <>
              <Text style={cardLabel}>Total TTC</Text>
              <Text style={cardValueLarge}>{totalTtcEur}</Text>
            </>
          )}
        </Section>

        {messageCustomer && (
          <Section style={messageBox}>
            <Text style={messageText}>{messageCustomer}</Text>
          </Section>
        )}

        <Section style={ctaSection}>
          <Button href={publicUrl} style={button}>Consulter & accepter le devis</Button>
        </Section>

        {pdfUrl && (
          <Text style={small}>
            Ou téléchargez directement le PDF : <Link href={pdfUrl} style={link}>{quoteNumber}.pdf</Link>
          </Text>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          Ce lien est sécurisé et personnel. Il expire automatiquement après la date de validité.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: QuoteSentEmail,
  subject: 'Votre devis MediKong est disponible',
  displayName: 'Devis — envoi acheteur',
  previewData: {
    quoteNumber: 'Q-2026-00042',
    vendorName: 'Fixmer Pharma',
    customerName: 'JC Pharma',
    totalTtcEur: '1.561,00 €',
    validUntil: '01/07/2026',
    publicUrl: 'https://medikong.pro/devis/exemple',
    pdfUrl: 'https://medikong.pro/quote.pdf',
    messageCustomer: 'Merci pour votre demande, voici notre proposition.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '"DM Sans", Arial, sans-serif' }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { color: '#1E252F', fontSize: '24px', fontWeight: 700, margin: '0 0 16px', letterSpacing: '-0.02em' }
const text = { color: '#1E252F', fontSize: '15px', lineHeight: '24px', margin: '0 0 12px' }
const card = { backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '20px', margin: '20px 0', border: '1px solid #E2E8F0' }
const cardLabel = { color: '#64748B', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 4px' }
const cardValue = { color: '#1E252F', fontSize: '16px', fontWeight: 600, margin: '0 0 12px' }
const cardValueLarge = { color: '#1C58D9', fontSize: '22px', fontWeight: 700, margin: '0' }
const messageBox = { backgroundColor: '#EFF6FF', borderLeft: '3px solid #1C58D9', padding: '12px 16px', margin: '16px 0', borderRadius: '4px' }
const messageText = { color: '#1E252F', fontSize: '14px', lineHeight: '22px', margin: 0, fontStyle: 'italic' as const }
const ctaSection = { textAlign: 'center' as const, margin: '28px 0' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 600, display: 'inline-block' }
const small = { color: '#64748B', fontSize: '13px', textAlign: 'center' as const, margin: '12px 0' }
const link = { color: '#1C58D9', textDecoration: 'underline' }
const hr = { borderColor: '#E2E8F0', margin: '24px 0' }
const footer = { color: '#94A3B8', fontSize: '12px', lineHeight: '18px', margin: 0 }
