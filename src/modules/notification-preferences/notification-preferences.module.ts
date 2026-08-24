import { Module } from '@nestjs/common';
import { NotificationPreferencesController } from './notification-preferences.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '@/modules/authorization';
import { UsersModule } from '@/modules/users';
import { NotificationPreferencesEntity } from './entities/notification-preferences.entity';
import { NotificationPreferencesRepository } from './notification-preferences.repository';
import { NotificationPreferencesService } from './notification-preferences.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationPreferencesEntity]),
    AuthorizationModule,
    UsersModule,
  ],
  controllers: [NotificationPreferencesController],
  providers: [NotificationPreferencesService, NotificationPreferencesRepository],
  exports: [NotificationPreferencesService],
})
export class NotificationPreferencesModule {}
