import type Redis from 'ioredis';

import { RedisLifecycleService } from './redis-lifecycle.service';

describe(RedisLifecycleService.name, () => {
  it('connects and closes the client with the application lifecycle', async () => {
    const client = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue('OK'),
      status: 'ready',
    } as unknown as Redis;
    const service = new RedisLifecycleService(client);

    await service.onModuleInit();
    await service.onApplicationShutdown();

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.quit).toHaveBeenCalledTimes(1);
  });

  it('does not close an already-ended client', async () => {
    const client = {
      quit: jest.fn(),
      status: 'end',
    } as unknown as Redis;
    const service = new RedisLifecycleService(client);

    await service.onApplicationShutdown();

    expect(client.quit).not.toHaveBeenCalled();
  });
});
