import { Module } from '@nestjs/common';

import { FilesModule } from './files.module';
import { FilesProcessor } from './files.processor';
import { FilesWorkerLifecycle } from './files-worker.lifecycle';

@Module({
  imports: [FilesModule],
  providers: [FilesProcessor, FilesWorkerLifecycle],
})
export class FilesWorkerConsumerModule {}
