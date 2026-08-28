export type OutboxTopic = 'mail.send' | 'file.delete' | 'file.migration-source-delete';
export type OutboxStatus = 'pending' | 'processing' | 'published' | 'failed';

export type OutboxPayload = object;

export const OUTBOX_QUEUE = 'outbox-relay';
/** Queue used by the outbox relay for durable mail delivery requests. */
export const OUTBOX_MAIL_QUEUE = 'mail';
