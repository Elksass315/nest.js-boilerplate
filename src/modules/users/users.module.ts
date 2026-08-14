import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthorizationModule } from '@/modules/authorization';
import { FilesModule } from '@/modules/files';
import { MailModule } from '@/modules/mail';

import { AvatarImageService } from './avatar-image.service';
import { UserRoleEntity } from './entities/user-role.entity';
import { UserSecurityAuditEntity } from './entities/user-security-audit.entity';
import { UserEntity } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UserAvatarUploadsController } from './user-avatar-uploads.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleEntity, UserSecurityAuditEntity]),
    AuthorizationModule,
    FilesModule,
    MailModule,
  ],
  controllers: [UsersController, UserAvatarUploadsController],
  providers: [UsersService, UsersRepository, AvatarImageService],
  exports: [UsersService],
})
export class UsersModule {}
