import type { OutboxMessageEntity } from './outbox.entity';

export const OUTBOX_CAPABILITY_PUBLISHER = Symbol('OUTBOX_CAPABILITY_PUBLISHER');

export interface OutboxCapabilityPublisher {
  supports(topic: string): boolean;
  publish(record: OutboxMessageEntity): Promise<void>;
  close(): Promise<void>;
}
