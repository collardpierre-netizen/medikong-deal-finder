import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

type EventKind = 'self_activated' | 'renewal_requested'

interface AdminVmiNotificationProps {
  eventKind?: EventKind
  vendorCompanyName?: string
  vendorContactEmail?: string
  vendorId?: string
  trialEndsAtFormatted?: string
  message?: string
  occurredAtFormatted?: string
}

const labels: Record<EventKind, { emoji: string; title: string; intro: string }> = {
  self_activated: {
    emoji: '✨',
    title: 'Essai Veille marché auto-activé',
    intro: "Un vendeur vient d'activer son essai gratuit de 180 jours du module Veille marché.",
  },
  renewal_requested: {
    emoji: '✉️',
    title: 'Demande de prolongation Veille marché',
    intro: "Un vendeur a déjà consommé son essai gratuit et demande une prolongation du module Veille marché.",
  },
}

const AdminVmiNotificationEmail = ({
  eventKind = 'self_activated',
  vendorCompanyName,
  vendorContactEmail,
  vendorId,
  trialEndsAtFormatted,
  message,
  occurredAtFormatted,
}: AdminVmiNotificationProps) => {
  const meta = labels[eventKind] || labels.self_activated
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{meta.title} — {vendorCompanyName || 'Vendeur'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="160" alt={SITE_NAME} style={logo} />

          <Heading style={h1}>{meta.emoji} {meta.title}</Heading>

          <Text style={text}>{meta.intro}</Text>

          <Section style={infoBox}>
            <Text style={infoLine}>
              <strong>Société :</strong> {vendorCompanyName || '—'}
            </Text>
            {vendorContactEmail ? (
              <Text style={infoLine}><strong>Email vendeur :</strong> {vendorContactEmail}</Text>
            ) : null}
            {vendorId ? (
              <Text style={infoLine}><strong>Vendor ID :</strong> {vendorId}</Text>
            ) : null}
            {eventKind === 'self_activated' && trialEndsAtFormatted ? (
              <Text style={infoLine}><strong>Fin d'essai :</strong> {trialEndsAtFormatted}</Text>
            ) : null}
            {occurredAtFormatted ? (
              <Text style={infoLine}><strong>Survenu le :</strong> {occurredAtFormatted}</Text>
            ) : null}
          </Section>

          {eventKind === 'renewal_requested' && message ? (
            <Section style={messageBox}>
              <Text style={messageLabel}>Message du vendeur :</Text>
              <Text style={messageText}>{message}</Text>
            </Section>
          ) : null}

          <Text style={text}>
            {eventKind === 'self_activated'
              ? "Vous pouvez suivre l'usage et l'expiration sur "
              : "Traitez la demande sur "}
            <a href="https://medikong.pro/admin/vendor-market-intel" style={link}>
              /admin/vendor-market-intel
            </a>.
          </Text>

          <Hr style={divider} />

          <Text style={footer}>Notification automatique — {SITE_NAME} Admin</Text>
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
  component: AdminVmiNotificationEmail,
  subject: ((data: Record<string, any>) => {
    const meta = labels[(data.eventKind as EventKind) || 'self_activated'] || labels.self_activated
    return `${meta.emoji} ${meta.title} — ${data.vendorCompanyName || 'Vendeur'}`
  }),
  displayName: 'Admin — Veille marché (activation/prolongation)',
  to: 'admin@medikong.pro',
  previewData: {
    eventKind: 'self_activated',
    vendorCompanyName: 'PharmaCorp SRL',
    vendorContactEmail: 'jean@pharmacorp.be',
    vendorId: '00000000-0000-0000-0000-000000000000',
    trialEndsAtFormatted: '22/10/2026',
    occurredAtFormatted: '12/05/2026 14:32',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '20px' }
const h1 = {
  fontSize: '22px',
  fontWeight: '700' as const,
  color: '#1e3a5f',
  margin: '0 0 16px',
  fontFamily: "'Plus Jakarta Sans', 'DM Sans', Arial, sans-serif",
}
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 14px' }
const infoBox = {
  backgroundColor: '#f1f5f9',
  borderLeft: '3px solid #1B5BDA',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '16px 0',
}
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }
const messageBox = {
  backgroundColor: '#fffbeb',
  borderLeft: '3px solid #f59e0b',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '16px 0',
}
const messageLabel = { fontSize: '12px', color: '#78350f', margin: '0 0 6px', fontWeight: '600' as const }
const messageText = { fontSize: '13px', color: '#1D2530', margin: '0', lineHeight: '1.5', whiteSpace: 'pre-wrap' as const }
const link = { color: '#1B5BDA', textDecoration: 'underline' }
const divider = { borderColor: '#d1d5db', margin: '20px 0 12px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '0' }
const legalFooter = { fontSize: '10px', color: '#9ca3af', margin: '12px 0 0', lineHeight: '1.5' }
