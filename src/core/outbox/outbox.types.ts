export type OutboxTopic = 'mail.send' | 'file.delete' | 'file.migration-source-delete';
export type OutboxStatus = 'pending' | 'processing' | 'published' | 'failed';

export type OutboxPayload = Record<string, unknown>;

export const OUTBOX_QUEUE = 'outbox-relay';
