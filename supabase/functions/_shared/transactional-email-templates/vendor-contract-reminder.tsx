import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'MediKong'
const LOGO_URL =
  'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

type ReminderLevel = 1 | 2 | 3

interface VendorContractReminderProps {
  vendorCompanyName?: string
  signerName?: string
  daysSinceInvitation?: number
  reminderLevel?: ReminderLevel
  contractVersion?: string
  contractUrl?: string
}

const LEVEL_COPY: Record<ReminderLevel, {
  emoji: string
  title: string
  intro: string
  urgency: string
  cta: string
  toneStyle: typeof urgencyBoxInfo
}> = {
  1: {
    emoji: '👋',
    title: 'Petit rappel — votre convention vous attend',
    intro:
      "Nous avons remarqué que vous n'avez pas encore signé la Convention de mandat de facturation. Sans cette signature, vous ne pouvez pas activer vos offres ni recevoir de commandes.",
    urgency:
      'Cela ne prend que quelques minutes. La majorité des vendeurs signent en moins de 2 minutes depuis leur portail.',
    cta: 'Signer maintenant',
    toneStyle: urgencyBoxInfo,
  },
  2: {
    emoji: '⏰',
    title: "Votre compte vendeur reste inactif",
    intro:
      "Votre profil vendeur est complet, mais la Convention de mandat de facturation n'est toujours pas signée. Tant qu'elle ne l'est pas, vos offres ne sont pas publiées et vous manquez chaque jour de potentielles ventes.",
    urgency:
      "C'est une exigence légale (article 53 §2 du Code TVA belge), pas une formalité {SITE_NAME}. Tous les vendeurs doivent la signer pour vendre sur la marketplace.",
    cta: 'Débloquer mon compte vendeur',
    toneStyle: urgencyBoxWarn,
  },
  3: {
    emoji: '🚨',
    title: 'Dernier rappel avant suspension du compte',
    intro:
      "Votre compte vendeur n'est toujours pas activé faute de signature de la Convention de mandat de facturation. Sans action de votre part dans les prochains jours, votre dossier vendeur sera suspendu et il faudra reprendre la procédure d'onboarding depuis le début.",
    urgency:
      "Si vous rencontrez une difficulté pour signer (profil incomplet, question juridique, problème technique), répondez simplement à cet email — l'équipe vendeurs vous accompagne.",
    cta: 'Signer pour conserver mon compte',
    toneStyle: urgencyBoxAlert,
  },
}

const VendorContractReminderEmail = ({
  vendorCompanyName,
  signerName,
  daysSinceInvitation,
  reminderLevel = 1,
  contractVersion,
  contractUrl,
}: VendorContractReminderProps) => {
  const level = ([1, 2, 3].includes(reminderLevel) ? reminderLevel : 1) as ReminderLevel
  const copy = LEVEL_COPY[level]
  const urgencyText = copy.urgency.replace('{SITE_NAME}', SITE_NAME)

  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>{copy.title}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt={SITE_NAME} style={logo} />

          <Heading style={h1}>{copy.emoji} {copy.title}</Heading>

          <Text style={text}>
            Bonjour{signerName ? ` ${signerName}` : ''},
          </Text>

          <Text style={text}>
            {copy.intro}
          </Text>

          <Section style={infoBox}>
            <Text style={infoLine}>
              <strong>Société :</strong> {vendorCompanyName || '—'}
            </Text>
            <Text style={infoLine}>
              <strong>Document :</strong> Convention de mandat de facturation
            </Text>
            {contractVersion ? (
              <Text style={infoLine}><strong>Version :</strong> {contractVersion}</Text>
            ) : null}
            {typeof daysSinceInvitation === 'number' ? (
              <Text style={infoLine}>
                <strong>Statut :</strong> non signée depuis {daysSinceInvitation} jour{daysSinceInvitation > 1 ? 's' : ''}
              </Text>
            ) : null}
            <Text style={infoLine}>
              <strong>Impact :</strong> aucune offre publiée, aucune commande possible
            </Text>
          </Section>

          <Section style={copy.toneStyle}>
            <Text style={urgencyText_}>{urgencyText}</Text>
          </Section>

          {contractUrl ? (
            <Button href={contractUrl} style={button}>
              {copy.cta}
            </Button>
          ) : null}

          <Text style={small}>
            La signature électronique est gratuite et prend moins de 2 minutes.
            Aucun frais n'est lié à la convention — seule la commission MediKong
            (20% HTVA par défaut) s'applique sur vos ventes.
          </Text>

          <Hr style={divider} />

          <Text style={footerText}>
            Une question ou un blocage ? Répondez à cet email ou contactez{' '}
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
  component: VendorContractReminderEmail,
  subject: ((data: Record<string, any>) => {
    const lvl = (data.reminderLevel ?? 1) as ReminderLevel
    if (lvl === 3) return '🚨 Dernier rappel — Votre compte vendeur va être suspendu'
    if (lvl === 2) return '⏰ Votre compte vendeur reste bloqué — signez votre convention'
    return '👋 Rappel — Signez votre convention de facturation MediKong'
  }),
  displayName: 'Vendeur — Relance signature (J+3 / J+7 / J+14)',
  previewData: {
    vendorCompanyName: 'PharmaCorp SRL',
    signerName: 'Jean Dupont',
    daysSinceInvitation: 7,
    reminderLevel: 2,
    contractVersion: 'v1.0',
    contractUrl: 'https://medikong.pro/vendor/contract',
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
const small = { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', margin: '12px 0 0' }
const infoBox = {
  backgroundColor: '#f1f5f9',
  borderLeft: '3px solid #1B5BDA',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '18px 0',
}
const infoLine = { fontSize: '13px', color: '#1D2530', margin: '4px 0', lineHeight: '1.5' }

const urgencyBoxInfo = {
  backgroundColor: '#eff6ff',
  borderLeft: '3px solid #3b82f6',
  borderRadius: '6px',
  padding: '12px 14px',
  margin: '14px 0',
}
const urgencyBoxWarn = {
  backgroundColor: '#fffbeb',
  borderLeft: '3px solid #f59e0b',
  borderRadius: '6px',
  padding: '12px 14px',
  margin: '14px 0',
}
const urgencyBoxAlert = {
  backgroundColor: '#fef2f2',
  borderLeft: '3px solid #dc2626',
  borderRadius: '6px',
  padding: '12px 14px',
  margin: '14px 0',
}
const urgencyText_ = { fontSize: '13px', color: '#1D2530', margin: '0', lineHeight: '1.6' }

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
