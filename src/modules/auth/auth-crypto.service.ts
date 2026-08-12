import { createHash, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import argon2 from 'argon2';
import { jwtVerify, SignJWT } from 'jose';

import type { AppConfiguration } from '@/config/configuration.types';

import type { AccessTokenClaims } from './auth.types';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,p=1,t=2$bG9jYWwtZHVtbXktc2FsdA$rw3+/AyfJxCXfXu4G0SiUVp30IaL+Z4dkdjIaTnhNXc';

@Injectable()
export class AuthCryptoService {
  private readonly secret: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly accessTtl: number;

  public constructor(config: ConfigService<AppConfiguration, true>) {
    this.secret = new TextEncoder().encode(
      config.getOrThrow('auth.accessTokenSecret', { infer: true }),
    );
    this.issuer = config.getOrThrow('auth.tokenIssuer', { infer: true });
    this.audience = config.getOrThrow('auth.tokenAudience', { infer: true });
    this.accessTtl = config.getOrThrow('auth.accessTokenTtlSeconds', { infer: true });
  }

  public hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  public async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  public verifyDummyPassword(password: string): Promise<boolean> {
    return this.verifyPassword(DUMMY_PASSWORD_HASH, password);
  }

  public opaqueToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hashToken(raw) };
  }

  public hashToken(raw: string): string {
    return createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  public async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ sid: claims.sessionId, av: claims.authVersion })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(claims.userId)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .setIssuedAt()
      .setExpirationTime(`${String(this.accessTtl)}s`)
      .setJti(randomBytes(16).toString('base64url'))
      .sign(this.secret);
  }

  public async verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        algorithms: ['HS256'],
        issuer: this.issuer,
        audience: this.audience,
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload['sid'] !== 'string' ||
        typeof payload['av'] !== 'number' ||
        !Number.isInteger(payload['av'])
      ) {
        return null;
      }
      return { userId: payload.sub, sessionId: payload['sid'], authVersion: payload['av'] };
    } catch {
      return null;
    }
  }
}
