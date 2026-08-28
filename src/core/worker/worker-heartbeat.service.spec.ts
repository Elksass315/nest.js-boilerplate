import { access } from 'node:fs/promises';

import { WorkerHeartbeatService } from './worker-heartbeat.service';

describe(WorkerHeartbeatService.name, () => {
  const workerName = `test-worker-${String(process.pid)}`;
  const heartbeatPath = `/tmp/nestjs-saas-${workerName}.heartbeat`;

  it('writes a heartbeat and removes it during shutdown', async () => {
    const service = new WorkerHeartbeatService();

    service.start(workerName);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await expect(access(heartbeatPath)).resolves.toBeUndefined();
    await service.stop(workerName);
    await expect(access(heartbeatPath)).rejects.toThrow();
  });

  it('does not create duplicate timers when started twice', async () => {
    const service = new WorkerHeartbeatService();

    service.start(workerName);
    service.start(workerName);
    await service.stop(workerName);
  });
});
