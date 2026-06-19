import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Row, Column, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/cms-images/email-logo-horizontal.png'

interface Props {
  delegateName?: string
  requesterName?: string
  requesterCompany?: string
  requesterEmail?: string
  requesterPhone?: string
  buyerProfile?: string
  postalCode?: string
  countryCode?: string
  preferredSlot?: string
  message?: string
  ctaUrl?: string
}

const Email = ({
  delegateName,
  requesterName = '—',
  requesterCompany,
  requesterEmail = '',
  requesterPhone = '',
  buyerProfile,
  postalCode,
  countryCode,
  preferredSlot,
  message,
  ctaUrl = 'https://medikong.pro/vendor/leads-rappel',
}: Props) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Nouvelle demande de rappel — {requesterName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />

        <Heading style={h1}>📞 Nouvelle demande de rappel</Heading>

        <Text style={text}>
          Bonjour{delegateName ? ` ${delegateName}` : ''},
        </Text>

        <Text style={text}>
          Un acheteur vérifié a demandé à être rappelé suite à la consultation
          de votre fiche délégué sur {SITE_NAME}. Merci de le recontacter rapidement.
        </Text>

        <Section style={summaryBox}>
          <Row>
            <Column style={summaryLabel}>Contact</Column>
            <Column style={summaryValue}><strong>{requesterName}</strong></Column>
          </Row>
          {requesterCompany && (
            <Row>
              <Column style={summaryLabel}>Société</Column>
              <Column style={summaryValue}>{requesterCompany}</Column>
            </Row>
          )}
          <Row>
            <Column style={summaryLabel}>Téléphone</Column>
            <Column style={summaryValue}><strong>{requesterPhone}</strong></Column>
          </Row>
          <Row>
            <Column style={summaryLabel}>Email</Column>
            <Column style={summaryValue}>{requesterEmail}</Column>
          </Row>
          {buyerProfile && (
            <Row>
              <Column style={summaryLabel}>Profil</Column>
              <Column style={summaryValue}>{buyerProfile}</Column>
            </Row>
          )}
          {(postalCode || countryCode) && (
            <Row>
              <Column style={summaryLabel}>Localisation</Column>
              <Column style={summaryValue}>{[postalCode, countryCode].filter(Boolean).join(' · ')}</Column>
            </Row>
          )}
          {preferredSlot && (
            <>
              <Hr style={divider} />
              <Row>
                <Column style={summaryLabel}>Créneau préféré</Column>
                <Column style={summaryValue}><strong>{preferredSlot}</strong></Column>
              </Row>
            </>
          )}
        </Section>

        {message && (
          <Section style={messageBox}>
            <Text style={messageTitle}>Message de l'acheteur</Text>
            <Text style={messageBody}>{message}</Text>
          </Section>
        )}

        <Button href={ctaUrl} style={button}>
          Traiter la demande
        </Button>

        <Text style={footerText}>
          Cette demande apparaît également dans votre portail vendeur,
          rubrique « Leads "Rappelez-moi" ».
        </Text>

        <Text style={footer}>L'équipe {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Rappel demandé par ${data.requesterName || 'un acheteur'}${data.requesterCompany ? ` (${data.requesterCompany})` : ''}`,
  displayName: 'Vendeur — Demande de rappel délégué',
  previewData: {
    delegateName: 'Sophie Martin',
    requesterName: 'Jean Dupont',
    requesterCompany: 'Pharmacie du Centre',
    requesterEmail: 'jean@pharmacie-centre.be',
    requesterPhone: '+32 470 12 34 56',
    buyerProfile: 'pharmacy',
    postalCode: '1000',
    countryCode: 'BE',
    preferredSlot: 'Lundi matin',
    message: "J'aimerais discuter des conditions pour la gamme dermo.",
    ctaUrl: 'https://medikong.pro/vendor/leads-rappel',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1E252F', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 18px' }
const summaryBox = { backgroundColor: '#f8f9fb', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: '1px solid #e5e7eb' }
const summaryLabel = { fontSize: '13px', color: '#6b7280', padding: '4px 0', verticalAlign: 'top' as const }
const summaryValue = { fontSize: '14px', color: '#1E252F', padding: '4px 0', textAlign: 'right' as const, verticalAlign: 'top' as const }
const divider = { borderColor: '#e5e7eb', margin: '12px 0' }
const messageBox = { backgroundColor: '#eff4ff', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', border: '1px solid #c7d8ff' }
const messageTitle = { fontSize: '13px', fontWeight: '600' as const, color: '#1C58D9', margin: '0 0 6px' }
const messageBody = { fontSize: '14px', color: '#1E252F', margin: '0', lineHeight: '1.5' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const footerText = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 20px' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
