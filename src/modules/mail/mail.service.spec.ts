import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';

import { RequestContextService } from '@/core/request-context/request-context.service';

import { MailService } from './mail.service';
import { MailRepository } from './mail.repository';
import { MAIL_QUEUE } from './mail.types';

describe(MailService.name, () => {
  const queue = { add: jest.fn() };
  const context = { getCorrelationId: jest.fn(() => 'corr-mail-1') };
  const repository = {
    createDelivery: jest.fn(),
    markFailed: jest.fn(),
  };
  const values: Record<string, string | number | boolean> = {
    'mail.enabled': true,
    'mail.actionBaseUrl': 'https://app.example.com',
    'mail.fromAddress': 'noreply@example.com',
    'mail.fromName': 'Example SaaS',
    'mail.maxRetries': 5,
    'mail.retryDelayMs': 30_000,
  };
  let service: MailService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: getQueueToken(MAIL_QUEUE), useValue: queue },
        { provide: RequestContextService, useValue: context },
        { provide: MailRepository, useValue: repository },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string): string | number | boolean => values[key] ?? false,
          },
        },
      ],
    }).compile();
    service = module.get(MailService);
    repository.createDelivery.mockResolvedValue({ id: 'delivery-1' });
  });

  afterEach(() => jest.clearAllMocks());

  it('enqueues a correlated verification job without logging its token', async () => {
    await service.sendEmailVerification({
      email: 'amina@example.com',
      fullName: 'Amina Hassan',
      token: 'secret-token',
      expiresInSeconds: 3600,
    });

    expect(queue.add).toHaveBeenCalledWith(
      'send-mail',
      expect.objectContaining({
        deliveryId: 'delivery-1',
        to: 'amina@example.com',
        template: 'email-verification',
        correlationId: 'corr-mail-1',
        context: expect.objectContaining({
          actionUrl: 'https://app.example.com/verify-email?token=secret-token',
          expiresInMinutes: 60,
        }),
      }),
      expect.objectContaining({ attempts: 5, removeOnComplete: { age: 3600 } }),
    );
  });

  it('uses the reset template and skips queues when mail is disabled', async () => {
    await service.sendPasswordReset({
      email: 'amina@example.com',
      fullName: 'Amina Hassan',
      token: 'reset-token',
      expiresInSeconds: 1800,
    });
    expect(queue.add).toHaveBeenCalledWith(
      'send-mail',
      expect.objectContaining({ template: 'reset-password' }),
      expect.anything(),
    );

    values['mail.enabled'] = false;
    await service.sendEmailVerification({
      email: 'amina@example.com',
      fullName: 'Amina Hassan',
      token: 'ignored',
      expiresInSeconds: 60,
    });
    expect(queue.add).toHaveBeenCalledTimes(1);
    values['mail.enabled'] = true;
  });

  it('queues correlated security codes and records queue failures safely', async () => {
    await service.sendTwoStepCode({
      email: 'amina@example.com',
      fullName: 'Amina Hassan',
      code: '482913',
      expiresInSeconds: 300,
      purpose: 'login',
    });
    expect(queue.add).toHaveBeenCalledWith(
      'send-mail',
      expect.objectContaining({
        deliveryId: 'delivery-1',
        template: 'two-step-code',
        correlationId: 'corr-mail-1',
        context: expect.objectContaining({ code: '482913', expiresInMinutes: 5 }),
      }),
      expect.anything(),
    );

    queue.add.mockRejectedValueOnce(new Error('Redis unavailable'));
    await expect(
      service.sendNewSession({
        email: 'amina@example.com',
        fullName: 'Amina Hassan',
        occurredAt: new Date('2026-08-12T12:00:00.000Z'),
      }),
    ).rejects.toThrow('Redis unavailable');
    expect(repository.markFailed).toHaveBeenCalledWith('delivery-1', 0, 'QUEUE_ENQUEUE_FAILED');
  });
});
