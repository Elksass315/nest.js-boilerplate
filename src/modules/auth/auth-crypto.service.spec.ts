import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { decodeJwt } from 'jose';

import { AuthCryptoService } from './auth-crypto.service';

describe(AuthCryptoService.name, () => {
  let service: AuthCryptoService;

  beforeEach(async () => {
    const values: Record<string, string | number> = {
      'auth.accessTokenSecret': 'test-only-secret-with-at-least-thirty-two-characters',
      'auth.tokenIssuer': 'test-issuer',
      'auth.tokenAudience': 'test-audience',
      'auth.accessTokenTtlSeconds': 900,
    };
    const module = await Test.createTestingModule({
      providers: [
        AuthCryptoService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string): string | number => values[key] ?? 'missing-test-value',
          },
        },
      ],
    }).compile();
    service = module.get(AuthCryptoService);
  });

  it('hashes and verifies Argon2id passwords', async () => {
    const hash = await service.hashPassword('Correct-Horse-Battery-2026!');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verifyPassword(hash, 'Correct-Horse-Battery-2026!')).resolves.toBe(true);
    await expect(service.verifyPassword(hash, 'wrong')).resolves.toBe(false);
    await expect(service.verifyPassword('malformed', 'wrong')).resolves.toBe(false);
  });

  it('generates opaque hashed tokens and verifies signed access claims', async () => {
    const opaque = service.opaqueToken();
    expect(opaque.raw).toHaveLength(43);
    expect(opaque.hash).toBe(service.hashToken(opaque.raw));

    const claims = {
      userId: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
      sessionId: 'b8f10c56-5e3c-42ee-8436-7994b9691ced',
      authVersion: 3,
    };
    const token = await service.signAccessToken(claims);
    const payload = decodeJwt(token);
    expect(payload).toEqual(
      expect.objectContaining({
        sub: claims.userId,
        sid: claims.sessionId,
        av: claims.authVersion,
      }),
    );
    expect(payload).not.toHaveProperty('jti');
    expect(payload).not.toHaveProperty('roles');
    expect(payload).not.toHaveProperty('permissions');
    await expect(service.verifyAccessToken(token)).resolves.toEqual(claims);
    await expect(service.verifyAccessToken(`${token}tampered`)).resolves.toBeNull();
  });
});
