import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FilesModule } from '@/modules/files';

import { UserAvatarAssociationEntity } from './entities/user-avatar-association.entity';
import { AvatarImageService } from './avatar-image.service';
import { UserAvatarUploadsController } from './user-avatar-uploads.controller';
import { UserAvatarsRepository } from './user-avatars.repository';
import { UserAvatarsService } from './user-avatars.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserAvatarAssociationEntity]), FilesModule],
  controllers: [UserAvatarUploadsController],
  providers: [AvatarImageService, UserAvatarsRepository, UserAvatarsService],
  exports: [AvatarImageService, UserAvatarsService],
})
export class UserAvatarsModule {}
