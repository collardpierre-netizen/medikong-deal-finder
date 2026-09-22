import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface InvestorInquiryConfirmationProps {
  firstName?: string
  amountRange?: string
  message?: string
}

const InvestorInquiryConfirmationEmail = ({
  firstName = '',
  amountRange = '',
  message = '',
}: InvestorInquiryConfirmationProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Votre demande d'informations investisseurs MediKong est bien reçue</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Merci pour votre intérêt</Heading>
        <Text style={text}>
          {firstName ? `Bonjour ${firstName},` : 'Bonjour,'}
        </Text>
        <Text style={text}>
          Nous avons bien reçu votre demande d'informations concernant la levée de fonds
          MediKong. Un membre de l'équipe vous recontacte sous 2 jours ouvrables pour vous
          transmettre le dossier investisseur et répondre à vos questions.
        </Text>
        {(amountRange || message) && (
          <Section style={box}>
            {amountRange && (
              <Text style={{ ...text, margin: '0 0 8px' }}>
                <strong>Montant envisagé :</strong> {amountRange}
              </Text>
            )}
            {message && (
              <Text style={{ ...text, margin: 0 }}>
                <strong>Votre message :</strong> {message}
              </Text>
            )}
          </Section>
        )}
        <Text style={text}>
          Ticket minimum : 2 500 €. Tax Shelter accessible dès 5 000 € (maximum 50 000 € par
          personne physique, 100 000 € par contribuable).
        </Text>
        <Hr style={divider} />
        <Text style={footer}>
          MediKong — Balooh SRL, 23 rue de la Procession, 7822 Ath (Belgique)
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InvestorInquiryConfirmationEmail,
  subject: 'Votre demande d\'informations investisseurs MediKong',
  displayName: 'Invest — confirmation demande investisseur',
  previewData: {
    firstName: 'Jean',
    amountRange: '5 000 € – 25 000 €',
    message: 'Intéressé par le Tax Shelter.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 14px' }
const box = { backgroundColor: '#f8f9fb', borderRadius: '8px', padding: '16px', marginBottom: '16px', border: '1px solid #d1d5db' }
const divider = { borderColor: '#e5e7eb', margin: '24px 0 12px' }
const footer = { fontSize: '11px', color: '#9ca3af' }
