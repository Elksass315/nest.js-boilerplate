import { Test } from '@nestjs/testing';

import type { AuthenticatedPrincipal } from '@/modules/authorization';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe(AuthController.name, () => {
  const service = {
    register: jest.fn(),
    resendVerification: jest.fn(),
    verifyEmail: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    changePassword: jest.fn(),
    logout: jest.fn(),
  };
  const principal: AuthenticatedPrincipal = {
    userId: '7b3f8ed4-73ef-4afe-8703-b10dd32f3820',
    sessionId: 'b8f10c56-5e3c-42ee-8436-7994b9691ced',
    authVersion: 1,
    roleKeys: ['user'],
    permissions: [],
  };
  let controller: AuthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();
    controller = module.get(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  it('delegates public authentication workflows without exposing delivery tokens', async () => {
    service.login.mockResolvedValue({ accessToken: 'access' });
    service.refresh.mockResolvedValue({ accessToken: 'next' });
    service.verifyEmail.mockResolvedValue({ message: 'Email address verified' });
    service.resetPassword.mockResolvedValue({ message: 'Password reset completed' });

    await expect(
      controller.register({
        fullName: 'Amina Hassan',
        email: 'a@example.com',
        password: 'password',
      }),
    ).resolves.toEqual({
      message: 'Registration accepted; check your email to verify the account',
    });
    await expect(controller.resendVerification({ email: 'a@example.com' })).resolves.toEqual({
      message: 'If the account is eligible, a verification email will be sent',
    });
    await expect(controller.forgotPassword({ email: 'a@example.com' })).resolves.toEqual({
      message: 'If the account is eligible, password reset instructions will be sent',
    });
    await controller.verifyEmail({ token: 't'.repeat(43) });
    await controller.login({ email: 'a@example.com', password: 'password' });
    await controller.refresh({ refreshToken: 'r'.repeat(43) });
    await controller.resetPassword({ token: 't'.repeat(43), newPassword: 'new-password' });
    expect(service.register).toHaveBeenCalled();
  });

  it('delegates protected password and logout workflows', async () => {
    service.changePassword.mockResolvedValue({ message: 'changed' });
    await controller.changePassword(principal, {
      currentPassword: 'current',
      newPassword: 'new-password',
    });
    await controller.logout(principal);
    expect(service.logout).toHaveBeenCalledWith(principal.sessionId, principal.userId);
  });
});
