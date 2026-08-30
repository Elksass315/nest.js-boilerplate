import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { FilesModule } from './files.module';
import { FilesProcessor } from './files.processor';
import { FilesWorkerLifecycle } from './files-worker.lifecycle';
import { FILE_QUEUE } from './files.types';

@Module({
  imports: [FilesModule, BullModule.registerQueue({ name: FILE_QUEUE })],
  providers: [FilesProcessor, FilesWorkerLifecycle],
})
export class FilesWorkerConsumerModule {}
