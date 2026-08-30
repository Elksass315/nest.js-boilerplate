import { ConfigService } from '@nestjs/config';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';

import { RequestContextService } from '@/core/request-context/request-context.service';
import { OutboxRepository } from '@/core/outbox/outbox.repository';

import { MailService } from './mail.service';
import { MailRepository } from './mail.repository';

describe(MailService.name, () => {
  const context = { getCorrelationId: jest.fn(() => 'corr-mail-1') };
  const repository = {
    createDelivery: jest.fn(),
  };
  const outbox = { insert: jest.fn() };
  const dataSource = {
    transaction: jest.fn(async (callback: (manager: object) => Promise<void>) => callback({})),
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
        { provide: RequestContextService, useValue: context },
        { provide: MailRepository, useValue: repository },
        { provide: OutboxRepository, useValue: outbox },
        { provide: getDataSourceToken(), useValue: dataSource },
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

  it('enqueues a correlated verification-code job without a link or token', async () => {
    await service.sendEmailVerification({
      email: 'amina@example.com',
      fullName: 'Amina Hassan',
      code: '482913',
      expiresInSeconds: 600,
    });

    expect(outbox.insert).toHaveBeenCalledWith(
      expect.anything(),
      'mail.send',
      expect.objectContaining({
        deliveryId: 'delivery-1',
        to: 'amina@example.com',
        template: 'email-verification',
        correlationId: 'corr-mail-1',
        context: expect.objectContaining({
          code: '482913',
          expiresInMinutes: 10,
        }),
      }),
      'corr-mail-1',
    );
  });

  it('uses the reset template and skips queues when mail is disabled', async () => {
    await service.sendPasswordReset({
      email: 'amina@example.com',
      fullName: 'Amina Hassan',
      token: 'reset-token',
      expiresInSeconds: 1800,
    });
    expect(outbox.insert).toHaveBeenCalledWith(
      expect.anything(),
      'mail.send',
      expect.objectContaining({ template: 'reset-password' }),
      'corr-mail-1',
    );

    values['mail.enabled'] = false;
    await service.sendEmailVerification({
      email: 'amina@example.com',
      fullName: 'Amina Hassan',
      code: '482913',
      expiresInSeconds: 60,
    });
    expect(outbox.insert).toHaveBeenCalledTimes(1);
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
    expect(outbox.insert).toHaveBeenCalledWith(
      expect.anything(),
      'mail.send',
      expect.objectContaining({
        deliveryId: 'delivery-1',
        template: 'two-step-code',
        correlationId: 'corr-mail-1',
        context: expect.objectContaining({ code: '482913', expiresInMinutes: 5 }),
      }),
      'corr-mail-1',
    );

    outbox.insert.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(
      service.sendNewSession({
        email: 'amina@example.com',
        fullName: 'Amina Hassan',
        occurredAt: new Date('2026-08-12T12:00:00.000Z'),
      }),
    ).rejects.toThrow('Database unavailable');
  });

  it('queues a correlated invitation-acceptance security notice', async () => {
    await service.sendInvitationAccepted({
      email: 'amina@example.com',
      fullName: 'Amina Hassan',
      occurredAt: new Date('2026-08-18T12:00:00.000Z'),
    });

    expect(outbox.insert).toHaveBeenCalledWith(
      expect.anything(),
      'mail.send',
      expect.objectContaining({
        template: 'team-invitation-accepted',
        correlationId: 'corr-mail-1',
      }),
      'corr-mail-1',
    );
  });

  it('writes nonessential security notices through the same durable outbox path', async () => {
    await service.sendForcedSessionRevocation({
      email: 'amina@example.com',
      fullName: 'Amina Hassan',
      occurredAt: new Date('2026-08-18T12:00:00.000Z'),
    });

    expect(outbox.insert).toHaveBeenCalledWith(
      expect.anything(),
      'mail.send',
      expect.objectContaining({ template: 'session-revoked' }),
      'corr-mail-1',
    );
  });
});
