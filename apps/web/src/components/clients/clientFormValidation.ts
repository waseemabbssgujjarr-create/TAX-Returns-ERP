import { CNIC_MUST_BE_13_DIGITS, NTN_MUST_BE_7_DIGITS } from '@taxdesk/schemas'

export const IDENTIFIER_REQUIRED_MESSAGE = 'At least one of CNIC or NTN is required'

type TranslateClientsForm = (
  key:
    | 'form.validation.displayNameRequired'
    | 'form.validation.identifierRequired'
    | 'form.validation.cnicMustBe13Digits'
    | 'form.validation.ntnMustBe7Digits',
) => string

export function translateClientFieldError(
  t: TranslateClientsForm,
  field: 'displayName' | 'cnic' | 'ntn',
  message?: string,
): string | undefined {
  if (!message) return undefined

  if (field === 'displayName') {
    return t('form.validation.displayNameRequired')
  }

  if (field === 'cnic') {
    if (message === IDENTIFIER_REQUIRED_MESSAGE) {
      return t('form.validation.identifierRequired')
    }
    if (
      message === CNIC_MUST_BE_13_DIGITS ||
      message === 'CNIC must be in format XXXXX-XXXXXXX-X (13 digits)'
    ) {
      return t('form.validation.cnicMustBe13Digits')
    }
  }

  if (field === 'ntn' && message === NTN_MUST_BE_7_DIGITS) {
    return t('form.validation.ntnMustBe7Digits')
  }

  return message
}
