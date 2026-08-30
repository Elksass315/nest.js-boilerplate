import type { Job } from 'bullmq';
import type { PinoLogger } from 'nestjs-pino';

import { MailProcessor } from './mail.processor';
import type { MailRepository } from './mail.repository';
import type { MailJob } from './mail.types';
import type { SmtpProvider } from './smtp.provider';
import type { TemplateRendererService } from './template-renderer.service';

describe(MailProcessor.name, () => {
  const renderer = { render: jest.fn(() => '<html>safe</html>') };
  const smtp = { send: jest.fn() };
  const repository = {
    markProcessing: jest.fn(),
    markSent: jest.fn(),
    markFailed: jest.fn(),
  };
  const logger = {
    setContext: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  };
  const processor = new MailProcessor(
    renderer as unknown as TemplateRendererService,
    smtp as unknown as SmtpProvider,
    repository as unknown as MailRepository,
    logger as unknown as PinoLogger,
  );
  const data: MailJob = {
    deliveryId: 'delivery-1',
    to: 'private@example.com',
    fromAddress: 'noreply@example.com',
    fromName: 'Example SaaS',
    subject: 'Security notice',
    template: 'new-session',
    context: { name: 'Amina' },
    correlationId: 'corr-1',
  };

  afterEach(() => jest.clearAllMocks());

  beforeEach(() => {
    repository.markProcessing.mockResolvedValue(true);
  });

  it('renders, sends, and records successful SMTP delivery without logging recipient data', async () => {
    const job = { data, attemptsMade: 0, opts: { attempts: 5 }, id: 'job-1' } as Job<MailJob>;

    await processor.process(job);

    expect(renderer.render).toHaveBeenCalledWith('new-session', 'Security notice', data.context);
    expect(smtp.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'private@example.com' }));
    expect(repository.markSent).toHaveBeenCalledWith('delivery-1', 1);
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('private@example.com');
  });

  it('records only a safe error code after the final retry and rethrows for BullMQ', async () => {
    smtp.send.mockRejectedValueOnce(new Error('SMTP response contained private data'));
    const job = { data, attemptsMade: 4, opts: { attempts: 5 }, id: 'job-1' } as Job<MailJob>;

    await expect(processor.process(job)).rejects.toThrow('Mail delivery failed');

    expect(repository.markFailed).toHaveBeenCalledWith('delivery-1', 5, 'SMTP_DELIVERY_FAILED');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('SMTP response contained');
  });

  it('does not send a duplicate relay after the delivery is already sent', async () => {
    repository.markProcessing.mockResolvedValueOnce(false);
    const job = { data, attemptsMade: 1, opts: { attempts: 5 }, id: 'job-1' } as Job<MailJob>;

    await processor.process(job);

    expect(smtp.send).not.toHaveBeenCalled();
    expect(repository.markSent).not.toHaveBeenCalled();
  });
});
