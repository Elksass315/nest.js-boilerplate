import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '@/modules/users';
import { MailModule } from '@/modules/mail';

import { AuthController } from './auth.controller';
import { AuthCryptoService } from './auth-crypto.service';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthActionTokenEntity } from './entities/auth-action-token.entity';
import { AuthRefreshTokenEntity } from './entities/auth-refresh-token.entity';
import { AuthSessionEntity } from './entities/auth-session.entity';
import { AccessTokenGuard } from './guards/access-token.guard';
import { SessionsController } from './sessions.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuthSessionEntity, AuthRefreshTokenEntity, AuthActionTokenEntity]),
    UsersModule,
    MailModule,
  ],
  controllers: [AuthController, SessionsController],
  providers: [
    AuthService,
    AuthRepository,
    AuthCryptoService,
    { provide: APP_GUARD, useClass: AccessTokenGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
