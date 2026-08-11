import { RequestContextService } from './request-context.service';

describe(RequestContextService.name, () => {
  it('preserves request and correlation identifiers across async work', async () => {
    const service = new RequestContextService();
    await new Promise<void>((resolve) => {
      service.run({ requestId: 'request-1', correlationId: 'correlation-1' }, () => {
        void Promise.resolve().then(() => {
          expect(service.getRequestId()).toBe('request-1');
          expect(service.getCorrelationId()).toBe('correlation-1');
          resolve();
        });
      });
    });
  });
});
