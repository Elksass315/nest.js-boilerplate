import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FilesModule } from '@/modules/files';
import { USER_PROFILE_ENRICHER, UsersModule } from '@/modules/users';

import { UserAvatarAssociationEntity } from './entities/user-avatar-association.entity';
import { AvatarImageService } from './avatar-image.service';
import { UserAvatarUploadsController } from './user-avatar-uploads.controller';
import { UserAvatarsController } from './user-avatars.controller';
import { UserAvatarsRepository } from './user-avatars.repository';
import { UserAvatarsService } from './user-avatars.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserAvatarAssociationEntity]), FilesModule, UsersModule],
  controllers: [UserAvatarUploadsController, UserAvatarsController],
  providers: [
    AvatarImageService,
    UserAvatarsRepository,
    UserAvatarsService,
    { provide: USER_PROFILE_ENRICHER, useExisting: UserAvatarsService },
  ],
  exports: [AvatarImageService, UserAvatarsService],
})
export class UserAvatarsModule {}
