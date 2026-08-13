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
  };
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
});
