import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';

import { MailDeliveryEntity } from './entities/mail-delivery.entity';
import type { MailTemplate } from './mail.types';

@Injectable()
export class MailRepository {
  public constructor(
    @InjectRepository(MailDeliveryEntity)
    private readonly deliveries: Repository<MailDeliveryEntity>,
  ) {}

  public createDelivery(
    recipient: string,
    template: MailTemplate,
    correlationId: string | null,
    manager?: EntityManager,
  ): Promise<MailDeliveryEntity> {
    const repository = manager?.getRepository(MailDeliveryEntity) ?? this.deliveries;
    return repository.save(
      repository.create({
        recipientHash: createHash('sha256').update(recipient.toLowerCase(), 'utf8').digest('hex'),
        maskedRecipient: maskEmail(recipient),
        template,
        status: 'queued',
        attempts: 0,
        provider: null,
        errorCode: null,
        correlationId,
        sentAt: null,
      }),
    );
  }

  public async markProcessing(id: string, attempts: number): Promise<boolean> {
    const result = await this.deliveries
      .createQueryBuilder()
      .update(MailDeliveryEntity)
      .set({ status: 'processing', attempts })
      .where('id = :id AND status <> :sent', { id, sent: 'sent' })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  public async markSent(id: string, attempts: number): Promise<void> {
    await this.deliveries.update(id, {
      status: 'sent',
      attempts,
      provider: 'smtp',
      errorCode: null,
      sentAt: new Date(),
    });
  }

  public async markFailed(id: string, attempts: number, errorCode: string): Promise<void> {
    await this.deliveries.update(id, { status: 'failed', attempts, errorCode });
  }
}

function maskEmail(email: string): string {
  const separator = email.lastIndexOf('@');
  if (separator <= 0) return '[invalid]';
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}
