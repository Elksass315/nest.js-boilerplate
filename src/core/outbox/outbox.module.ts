import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OutboxMessageEntity } from './outbox.entity';
import { OutboxRepository } from './outbox.repository';

@Module({
  imports: [TypeOrmModule.forFeature([OutboxMessageEntity])],
  providers: [OutboxRepository],
  exports: [OutboxRepository],
})
export class OutboxModule {}
