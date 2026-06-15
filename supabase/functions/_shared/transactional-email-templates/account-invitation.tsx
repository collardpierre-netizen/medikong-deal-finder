import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Img, Preview, Text, Button, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "MediKong"
const LOGO_URL = 'https://iokwqxhhpblcbkrxgcje.supabase.co/storage/v1/object/public/email-assets/logo-horizontal.png'

interface Props {
  invitationUrl?: string
  role?: string
  accountKind?: string
}

const AccountInvitationEmail = ({ invitationUrl, role, accountKind }: Props) => {
  const kindLabel = accountKind === 'vendor' ? 'vendeur' : accountKind === 'buyer' ? 'acheteur' : ''
  const roleLabel = role === 'admin' ? 'Administrateur' : 'Membre'
  return (
    <Html lang="fr" dir="ltr">
      <Head />
      <Preview>Vous êtes invité·e à rejoindre un compte {kindLabel} sur {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img src={LOGO_URL} width="180" alt="MediKong" style={{ marginBottom: '24px' }} />
          <Heading style={h1}>Vous êtes invité·e à rejoindre {SITE_NAME}</Heading>
          <Text style={text}>
            Vous avez été invité·e à rejoindre un compte {kindLabel} sur <strong>{SITE_NAME}</strong>
            {' '}avec le rôle <strong>{roleLabel}</strong>.
          </Text>
          <Text style={text}>
            Cliquez sur le bouton ci-dessous pour accepter l'invitation. Connectez-vous (ou créez un compte) avec
            l'email exact qui a reçu ce message.
          </Text>
          {invitationUrl && (
            <Button href={invitationUrl} style={button}>Accepter l'invitation</Button>
          )}
          <Hr style={divider} />
          <Text style={footerText}>
            Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
          </Text>
          <Text style={{ ...footerText, wordBreak: 'break-all' as const, color: '#1C58D9' }}>{invitationUrl}</Text>
          <Text style={footer}>L'équipe {SITE_NAME}</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AccountInvitationEmail,
  subject: `Invitation à rejoindre un compte sur ${SITE_NAME}`,
  displayName: 'Invitation compte',
  previewData: { invitationUrl: 'https://medikong.pro/account/invitation/abc123', role: 'member', accountKind: 'vendor' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: '700' as const, color: '#1e3a5f', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#55575d', lineHeight: '1.6', margin: '0 0 20px' }
const button = { backgroundColor: '#1C58D9', color: '#ffffff', borderRadius: '8px', padding: '14px 32px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', marginBottom: '24px' }
const divider = { borderColor: '#d1d5db', margin: '20px 0' }
const footerText = { fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }
const footer = { fontSize: '11px', color: '#9ca3af', margin: '16px 0 0' }
