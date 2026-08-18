import { Module } from '@nestjs/common';
import { InvitationsController } from './invitations.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthorizationModule } from '@/modules/authorization';
import { MailModule } from '@/modules/mail';
import { UsersModule } from '@/modules/users';

import { InvitationEntity } from './entities/invitation.entity';
import { InvitationsRepository } from './invitations.repository';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvitationEntity]),
    AuthorizationModule,
    UsersModule,
    MailModule,
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationsRepository],
  exports: [InvitationsService],
})
export class InvitationsModule {}
