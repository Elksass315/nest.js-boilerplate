import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthorizationModule } from '@/modules/authorization';

import { UserRoleEntity } from './entities/user-role.entity';
import { UserSecurityAuditEntity } from './entities/user-security-audit.entity';
import { UserEntity } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleEntity, UserSecurityAuditEntity]),
    AuthorizationModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService],
})
export class UsersModule {}
