import type { HealthService } from './health.service';
import { HealthController } from './health.controller';

describe(HealthController.name, () => {
  it('delegates health checks to the service', async () => {
    const healthService = {
      getLiveness: jest.fn().mockReturnValue({ status: 'ok' }),
      getReadiness: jest.fn().mockResolvedValue({ status: 'ok' }),
    } as unknown as HealthService;
    const controller = new HealthController(healthService);

    expect(controller.getLiveness()).toEqual({ status: 'ok' });
    await expect(controller.getReadiness()).resolves.toEqual({ status: 'ok' });
  });
});
