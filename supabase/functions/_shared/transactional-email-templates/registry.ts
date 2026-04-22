/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as orderConfirmation } from './order-confirmation.tsx'
import { template as vendorApplication } from './vendor-application.tsx'
import { template as vendorApproved } from './vendor-approved.tsx'
import { template as vendorRejected } from './vendor-rejected.tsx'
import { template as buyerRegistration } from './buyer-registration.tsx'
import { template as vendorContractSigned } from './vendor-contract-signed.tsx'
import { template as adminContractNotification } from './admin-contract-notification.tsx'
import { template as vendorContractSubmitted } from './vendor-contract-submitted.tsx'
import { template as vendorContractReminder } from './vendor-contract-reminder.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'order-confirmation': orderConfirmation,
  'vendor-application': vendorApplication,
  'vendor-approved': vendorApproved,
  'vendor-rejected': vendorRejected,
  'buyer-registration': buyerRegistration,
  'vendor-contract-signed': vendorContractSigned,
  'admin-contract-notification': adminContractNotification,
  'vendor-contract-submitted': vendorContractSubmitted,
  'vendor-contract-reminder': vendorContractReminder,
}
