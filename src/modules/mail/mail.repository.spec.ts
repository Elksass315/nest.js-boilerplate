import type { Repository } from 'typeorm';

import type { MailDeliveryEntity } from './entities/mail-delivery.entity';
import { MailRepository } from './mail.repository';

describe(MailRepository.name, () => {
  const deliveries = {
    create: jest.fn((value: Partial<MailDeliveryEntity>) => value),
    save: jest.fn((value: Partial<MailDeliveryEntity>) =>
      Promise.resolve({ id: 'delivery-1', ...value }),
    ),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
    query: jest.fn(),
  };
  const queryBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  deliveries.createQueryBuilder.mockReturnValue(queryBuilder);
  const repository = new MailRepository(deliveries as unknown as Repository<MailDeliveryEntity>);

  afterEach(() => jest.clearAllMocks());

  it('stores a deterministic fingerprint and masked recipient instead of the full address', async () => {
    await repository.createDelivery('Amina.Private@example.com', 'two-step-code', 'corr-1');

    expect(deliveries.create).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        maskedRecipient: 'A***@example.com',
        correlationId: 'corr-1',
      }),
    );
    expect(JSON.stringify(deliveries.create.mock.calls)).not.toContain('Amina.Private@example.com');
  });

  it('cleans only bounded terminal deliveries', async () => {
    deliveries.query.mockResolvedValue({ rowCount: 2 });
    await expect(repository.cleanupDeliveries(new Date('2026-01-01'), 5)).resolves.toBe(2);
    deliveries.query.mockResolvedValue(undefined);
    await expect(repository.cleanupDeliveries(new Date('2026-01-01'), 5)).resolves.toBe(0);
  });

  it('records only safe terminal delivery metadata', async () => {
    await repository.markSent('delivery-1', 2);
    await repository.markFailed('delivery-2', 5, 'SMTP_DELIVERY_FAILED');

    expect(deliveries.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({ status: 'sent', attempts: 2, provider: 'smtp' }),
    );
    expect(deliveries.update).toHaveBeenCalledWith('delivery-2', {
      status: 'failed',
      attempts: 5,
      errorCode: 'SMTP_DELIVERY_FAILED',
    });
  });

  it('claims processing only when the delivery is not already sent', async () => {
    await expect(repository.markProcessing('delivery-1', 1)).resolves.toBe(true);
    expect(queryBuilder.where).toHaveBeenCalledWith('id = :id AND status <> :sent', {
      id: 'delivery-1',
      sent: 'sent',
    });
  });
});
