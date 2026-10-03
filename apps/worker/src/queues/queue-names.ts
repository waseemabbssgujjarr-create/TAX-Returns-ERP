/**
 * Central registry of all BullMQ queue names.
 * Import from here — never use raw strings for queue names.
 */
export const QUEUE_NAMES = {
  DOCUMENT_PROCESSING: 'document-processing',
  AI_EXTRACTION: 'ai-extraction',
  REMINDER: 'reminder',
  EXPORT: 'export',
  NOTIFICATION: 'notification',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]
