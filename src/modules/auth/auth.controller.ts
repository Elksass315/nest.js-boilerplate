import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
  getSchemaPath,
} from '@nestjs/swagger';

import { API_VERSION } from '@/common/http/api-version.constants';
import {
  CurrentPrincipal,
  PermissionsGuard,
  RequireAuthenticated,
  type AuthenticatedPrincipal,
} from '@/modules/authorization';

import { AuthService } from './auth.service';
import {
  AUTH_PATH,
  errorContent,
  errorExample,
  messageContent,
  tokenPairContent,
} from './auth.swagger';
import { ActionTokenDto } from './dto/action-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailDto } from './dto/email.dto';
import { LoginDto } from './dto/login.dto';
import { MessageResponseDto } from './dto/message-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TokenPairResponseDto } from './dto/token-pair-response.dto';
import {
  CompleteLoginTwoStepDto,
  LoginTwoStepEmailCodeDto,
  LoginTwoStepRecoveryCodeDto,
  RecoveryCodesResponseDto,
  TwoStepActionRequestDto,
  TwoStepChallengeResponseDto,
  TwoStepCodeConfirmationDto,
} from './dto/two-step.dto';

const validationContent = (route: string): Record<string, { example: Record<string, unknown> }> =>
  errorContent(422, 'VALIDATION_ERROR', 'Input validation failed', route, {
    fields: { email: ['email must be an email'] },
  });

const challengeContent = {
  'application/json': {
    example: {
      requiresTwoStep: true,
      challengeToken: 'Y2hhbGxlbmdlLXRva2VuLWV4YW1wbGU',
      expiresIn: 300,
    },
  },
};

const recoveryCodesContent = {
  'application/json': {
    example: {
      recoveryCodes: ['7F3A-91BC-2D44-8E10', '19D2-77AB-4C03-5F91'],
    },
  },
};

type SwaggerErrorContent = Record<
  string,
  {
    examples: Record<string, { summary: string; value: ReturnType<typeof errorExample> }>;
  }
>;

const twoStepConfirmationErrorContent = (route: string): SwaggerErrorContent => ({
  'application/json': {
    examples: {
      authenticationRequired: {
        summary: 'No valid access token was supplied',
        value: errorExample(401, 'UNAUTHORIZED', 'Authentication is required', route),
      },
      invalidChallenge: {
        summary: 'The challenge is invalid, expired, or belongs to another user',
        value: errorExample(
          401,
          'INVALID_TWO_STEP_CHALLENGE',
          'The two-step challenge is invalid or has expired',
          route,
        ),
      },
      invalidCode: {
        summary: 'The emailed code is incorrect',
        value: errorExample(
          401,
          'INVALID_TWO_STEP_CODE',
          'The two-step verification code is incorrect',
          route,
        ),
      },
      attemptsExceeded: {
        summary: 'The challenge attempt limit was reached',
        value: errorExample(
          401,
          'TWO_STEP_ATTEMPTS_EXCEEDED',
          'Too many two-step verification attempts',
          route,
        ),
      },
    },
  },
});

const passwordConfirmationErrorContent = (route: string): SwaggerErrorContent => ({
  'application/json': {
    examples: {
      authenticationRequired: {
        summary: 'No valid access token was supplied',
        value: errorExample(401, 'UNAUTHORIZED', 'Authentication is required', route),
      },
      invalidPassword: {
        summary: 'The current password is incorrect',
        value: errorExample(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect', route),
      },
    },
  },
});

@ApiTags('auth')
@ApiExtraModels(
  TokenPairResponseDto,
  TwoStepChallengeResponseDto,
  LoginTwoStepEmailCodeDto,
  LoginTwoStepRecoveryCodeDto,
)
@UseGuards(PermissionsGuard)
@Controller({ path: 'auth', version: API_VERSION })
export class AuthController {
  public constructor(private readonly service: AuthService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Register an account',
    description: 'Creates a pending account and a single-use email-verification token.',
  })
  @ApiCreatedResponse({
    description: 'The account was created and verification delivery was requested.',
    content: messageContent('Registration accepted; check your email to verify the account'),
  })
  @ApiConflictResponse({
    description: 'The normalized email already belongs to an account.',
    content: errorContent(
      409,
      'EMAIL_ALREADY_REGISTERED',
      'An account with this email already exists',
      `${AUTH_PATH}/register`,
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The name, email, or password failed validation.',
    content: validationContent(`${AUTH_PATH}/register`),
  })
  public async register(@Body() body: RegisterDto): Promise<MessageResponseDto> {
    await this.service.register(body.fullName, body.email, body.password);
    return { message: 'Registration accepted; check your email to verify the account' };
  }

  @Post('verification/resend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend email verification',
    description: 'Returns the same response whether an eligible pending account exists.',
  })
  @ApiOkResponse({
    description: 'The generic resend response was returned.',
    content: messageContent('If the account is eligible, a verification email will be sent'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The email failed validation.',
    content: validationContent(`${AUTH_PATH}/verification/resend`),
  })
  public async resendVerification(@Body() body: EmailDto): Promise<MessageResponseDto> {
    await this.service.resendVerification(body.email);
    return { message: 'If the account is eligible, a verification email will be sent' };
  }

  @Post('verification/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm email verification',
    description: 'Consumes one valid verification token and activates the pending account.',
  })
  @ApiOkResponse({
    description: 'The email was verified.',
    content: messageContent('Email address verified'),
  })
  @ApiUnauthorizedResponse({
    description: 'The token is unknown, expired, superseded, or already consumed.',
    content: errorContent(
      401,
      'INVALID_OR_EXPIRED_TOKEN',
      'The token is invalid or has expired',
      `${AUTH_PATH}/verification/confirm`,
    ),
  })
  @ApiForbiddenResponse({
    description: 'The target account is suspended.',
    content: errorContent(
      403,
      'ACCOUNT_SUSPENDED',
      'The account is suspended',
      `${AUTH_PATH}/verification/confirm`,
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The token shape failed validation.',
    content: validationContent(`${AUTH_PATH}/verification/confirm`),
  })
  public verifyEmail(@Body() body: ActionTokenDto): Promise<MessageResponseDto> {
    return this.service.verifyEmail(body.token);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create an authenticated session',
    description:
      'Verifies credentials and returns a short-lived access token plus rotating refresh token.',
  })
  @ApiOkResponse({
    description: 'A session was created, or an email two-step challenge was issued.',
    content: {
      'application/json': {
        schema: {
          oneOf: [
            { $ref: getSchemaPath(TokenPairResponseDto) },
            { $ref: getSchemaPath(TwoStepChallengeResponseDto) },
          ],
        },
        examples: {
          sessionCreated: {
            summary: 'Two-step is disabled',
            value: tokenPairContent['application/json'].example,
          },
          twoStepRequired: {
            summary: 'Email two-step verification is required',
            value: {
              requiresTwoStep: true,
              challengeToken: 'Y2hhbGxlbmdlLXRva2VuLWV4YW1wbGU',
              expiresIn: 300,
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Credentials are invalid or the account is temporarily locked.',
    content: {
      'application/json': {
        examples: {
          invalidCredentials: {
            summary: 'Invalid credentials',
            value: errorExample(
              401,
              'INVALID_CREDENTIALS',
              'Email or password is incorrect',
              `${AUTH_PATH}/login`,
            ),
          },
          accountLocked: {
            summary: 'Temporary lockout',
            value: errorExample(
              401,
              'ACCOUNT_LOCKED',
              'The account is temporarily locked',
              `${AUTH_PATH}/login`,
            ),
          },
        },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'The credentials are valid but the account cannot sign in.',
    content: {
      'application/json': {
        examples: {
          emailNotVerified: {
            summary: 'Email not verified',
            value: errorExample(
              403,
              'EMAIL_NOT_VERIFIED',
              'Verify the email address before signing in',
              `${AUTH_PATH}/login`,
            ),
          },
          accountSuspended: {
            summary: 'Account suspended',
            value: errorExample(
              403,
              'ACCOUNT_SUSPENDED',
              'The account is suspended',
              `${AUTH_PATH}/login`,
            ),
          },
        },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'Credentials failed validation.',
    content: validationContent(`${AUTH_PATH}/login`),
  })
  public login(
    @Body() body: LoginDto,
  ): Promise<TokenPairResponseDto | TwoStepChallengeResponseDto> {
    return this.service.login(body.email, body.password);
  }

  @Post('login/two-step')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete login two-step verification',
    description:
      'Consumes either the emailed code or one single-use recovery code and creates the session.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(LoginTwoStepEmailCodeDto) },
        { $ref: getSchemaPath(LoginTwoStepRecoveryCodeDto) },
      ],
    },
    examples: {
      emailCode: {
        summary: 'Complete with the emailed code',
        value: {
          method: 'email_code',
          challengeToken: 'Y2hhbGxlbmdlLXRva2VuLWV4YW1wbGU',
          code: '482913',
        },
      },
      recoveryCode: {
        summary: 'Complete with a recovery code',
        value: {
          method: 'recovery_code',
          challengeToken: 'Y2hhbGxlbmdlLXRva2VuLWV4YW1wbGU',
          recoveryCode: '7F3A-91BC-2D44-8E10',
        },
      },
    },
  })
  @ApiOkResponse({ description: 'The two-step proof was accepted.', content: tokenPairContent })
  @ApiUnauthorizedResponse({
    description: 'The challenge, emailed code, or recovery code cannot be accepted.',
    content: {
      'application/json': {
        examples: {
          invalidChallenge: {
            summary: 'Invalid or expired challenge',
            value: errorExample(
              401,
              'INVALID_TWO_STEP_CHALLENGE',
              'The two-step challenge is invalid or has expired',
              `${AUTH_PATH}/login/two-step`,
            ),
          },
          invalidCode: {
            summary: 'Invalid emailed code',
            value: errorExample(
              401,
              'INVALID_TWO_STEP_CODE',
              'The two-step verification code is incorrect',
              `${AUTH_PATH}/login/two-step`,
            ),
          },
          invalidRecoveryCode: {
            summary: 'Invalid recovery code',
            value: errorExample(
              401,
              'INVALID_RECOVERY_CODE',
              'The recovery code is invalid or has already been used',
              `${AUTH_PATH}/login/two-step`,
            ),
          },
          attemptsExceeded: {
            summary: 'Attempt limit reached',
            value: errorExample(
              401,
              'TWO_STEP_ATTEMPTS_EXCEEDED',
              'Too many two-step verification attempts',
              `${AUTH_PATH}/login/two-step`,
            ),
          },
        },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'The account became unavailable before challenge completion.',
    content: errorContent(
      403,
      'ACCOUNT_SUSPENDED',
      'The account is suspended',
      `${AUTH_PATH}/login/two-step`,
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The selected proof body failed validation.',
    content: validationContent(`${AUTH_PATH}/login/two-step`),
  })
  public completeLoginTwoStep(
    @Body() body: CompleteLoginTwoStepDto,
  ): Promise<TokenPairResponseDto> {
    return this.service.completeLoginTwoStep(
      body.challengeToken,
      body.method === 'email_code'
        ? { method: 'email_code', code: body.code ?? '' }
        : { method: 'recovery_code', recoveryCode: body.recoveryCode ?? '' },
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate a refresh token',
    description: 'Consumes one active refresh token and returns a new token pair.',
  })
  @ApiOkResponse({ description: 'The refresh token was rotated.', content: tokenPairContent })
  @ApiUnauthorizedResponse({
    description: 'The refresh token is invalid, expired, revoked, or reused.',
    content: {
      'application/json': {
        examples: {
          invalid: {
            summary: 'Invalid refresh token',
            value: errorExample(
              401,
              'INVALID_REFRESH_TOKEN',
              'The refresh token is invalid or expired',
              `${AUTH_PATH}/refresh`,
            ),
          },
          reused: {
            summary: 'Rotated token reused',
            value: errorExample(
              401,
              'REFRESH_TOKEN_REUSED',
              'Refresh token reuse was detected and the session was revoked',
              `${AUTH_PATH}/refresh`,
            ),
          },
        },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'The refresh token shape failed validation.',
    content: validationContent(`${AUTH_PATH}/refresh`),
  })
  public refresh(@Body() body: RefreshTokenDto): Promise<TokenPairResponseDto> {
    return this.service.refresh(body.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset',
    description: 'Returns a generic response to prevent account enumeration.',
  })
  @ApiOkResponse({
    description: 'The generic reset response was returned.',
    content: messageContent('If the account is eligible, password reset instructions will be sent'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The email failed validation.',
    content: validationContent(`${AUTH_PATH}/forgot-password`),
  })
  public async forgotPassword(@Body() body: EmailDto): Promise<MessageResponseDto> {
    await this.service.forgotPassword(body.email);
    return { message: 'If the account is eligible, password reset instructions will be sent' };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset a password',
    description: 'Consumes a reset token, changes the password, and revokes every session.',
  })
  @ApiOkResponse({
    description: 'The password was reset.',
    content: messageContent('Password reset completed'),
  })
  @ApiUnauthorizedResponse({
    description: 'The reset token is invalid or expired.',
    content: errorContent(
      401,
      'INVALID_OR_EXPIRED_TOKEN',
      'The token is invalid or has expired',
      `${AUTH_PATH}/reset-password`,
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The token or password failed validation.',
    content: validationContent(`${AUTH_PATH}/reset-password`),
  })
  public resetPassword(@Body() body: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.service.resetPassword(body.token, body.newPassword);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Change the current password',
    description: 'Verifies the current password, changes it, and revokes every session.',
  })
  @ApiOkResponse({
    description: 'The password was changed and sessions were revoked.',
    content: messageContent('Password changed; all sessions were revoked'),
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication or the current password is invalid.',
    content: errorContent(
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect',
      `${AUTH_PATH}/change-password`,
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'A password failed validation.',
    content: validationContent(`${AUTH_PATH}/change-password`),
  })
  public changePassword(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: ChangePasswordDto,
  ): Promise<MessageResponseDto> {
    return this.service.changePassword(principal.userId, body.currentPassword, body.newPassword);
  }

  @Post('two-step/enable/request')
  @HttpCode(HttpStatus.OK)
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Request two-step enrollment',
    description: 'Verifies the current password and emails a five-minute enrollment code.',
  })
  @ApiOkResponse({ description: 'The enrollment challenge was issued.', content: challengeContent })
  @ApiUnauthorizedResponse({
    description: 'Authentication or the current password is invalid.',
    content: passwordConfirmationErrorContent(`${AUTH_PATH}/two-step/enable/request`),
  })
  @ApiConflictResponse({
    description: 'Email two-step verification is already enabled.',
    content: errorContent(
      409,
      'TWO_STEP_ALREADY_ENABLED',
      'Email two-step verification is already enabled',
      `${AUTH_PATH}/two-step/enable/request`,
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The current password failed validation.',
    content: validationContent(`${AUTH_PATH}/two-step/enable/request`),
  })
  public requestTwoStepEnable(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: TwoStepActionRequestDto,
  ): Promise<TwoStepChallengeResponseDto> {
    return this.service.requestTwoStepChange(principal.userId, body.currentPassword, 'enable');
  }

  @Post('two-step/enable/confirm')
  @HttpCode(HttpStatus.OK)
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Confirm two-step enrollment',
    description:
      'Consumes the emailed code, enables two-step verification, revokes sessions, and returns recovery codes once.',
  })
  @ApiOkResponse({
    description: 'Two-step was enabled and new recovery codes were returned once.',
    content: recoveryCodesContent,
  })
  @ApiUnauthorizedResponse({
    description: 'The challenge/code is invalid, expired, or has exceeded its attempt limit.',
    content: twoStepConfirmationErrorContent(`${AUTH_PATH}/two-step/enable/confirm`),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The challenge token or code failed validation.',
    content: validationContent(`${AUTH_PATH}/two-step/enable/confirm`),
  })
  public confirmTwoStepEnable(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: TwoStepCodeConfirmationDto,
  ): Promise<RecoveryCodesResponseDto> {
    return this.service.enableTwoStep(principal.userId, body.challengeToken, body.code);
  }

  @Post('two-step/disable/request')
  @HttpCode(HttpStatus.OK)
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Request two-step disablement',
    description: 'Verifies the current password and emails a five-minute confirmation code.',
  })
  @ApiOkResponse({ description: 'The disable challenge was issued.', content: challengeContent })
  @ApiUnauthorizedResponse({
    description: 'Authentication or the current password is invalid.',
    content: passwordConfirmationErrorContent(`${AUTH_PATH}/two-step/disable/request`),
  })
  @ApiConflictResponse({
    description: 'Email two-step verification is not enabled.',
    content: errorContent(
      409,
      'TWO_STEP_NOT_ENABLED',
      'Email two-step verification is not enabled',
      `${AUTH_PATH}/two-step/disable/request`,
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The current password failed validation.',
    content: validationContent(`${AUTH_PATH}/two-step/disable/request`),
  })
  public requestTwoStepDisable(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: TwoStepActionRequestDto,
  ): Promise<TwoStepChallengeResponseDto> {
    return this.service.requestTwoStepChange(principal.userId, body.currentPassword, 'disable');
  }

  @Post('two-step/disable/confirm')
  @HttpCode(HttpStatus.OK)
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Confirm two-step disablement',
    description: 'Consumes the emailed code, deletes recovery codes, and revokes every session.',
  })
  @ApiOkResponse({
    description: 'Two-step verification was disabled.',
    content: messageContent('Email two-step verification disabled; all sessions were revoked'),
  })
  @ApiUnauthorizedResponse({
    description: 'The challenge/code is invalid, expired, or has exceeded its attempt limit.',
    content: twoStepConfirmationErrorContent(`${AUTH_PATH}/two-step/disable/confirm`),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The challenge token or code failed validation.',
    content: validationContent(`${AUTH_PATH}/two-step/disable/confirm`),
  })
  public confirmTwoStepDisable(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: TwoStepCodeConfirmationDto,
  ): Promise<MessageResponseDto> {
    return this.service.disableTwoStep(principal.userId, body.challengeToken, body.code);
  }

  @Post('two-step/recovery-codes/regenerate/request')
  @HttpCode(HttpStatus.OK)
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Request recovery-code regeneration',
    description: 'Verifies the current password and emails a five-minute confirmation code.',
  })
  @ApiOkResponse({
    description: 'The recovery-code regeneration challenge was issued.',
    content: challengeContent,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication or the current password is invalid.',
    content: passwordConfirmationErrorContent(
      `${AUTH_PATH}/two-step/recovery-codes/regenerate/request`,
    ),
  })
  @ApiConflictResponse({
    description: 'Email two-step verification is not enabled.',
    content: errorContent(
      409,
      'TWO_STEP_NOT_ENABLED',
      'Email two-step verification is not enabled',
      `${AUTH_PATH}/two-step/recovery-codes/regenerate/request`,
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The current password failed validation.',
    content: validationContent(`${AUTH_PATH}/two-step/recovery-codes/regenerate/request`),
  })
  public requestRecoveryCodeRegeneration(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: TwoStepActionRequestDto,
  ): Promise<TwoStepChallengeResponseDto> {
    return this.service.requestTwoStepChange(
      principal.userId,
      body.currentPassword,
      'recovery_regenerate',
    );
  }

  @Post('two-step/recovery-codes/regenerate/confirm')
  @HttpCode(HttpStatus.OK)
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Confirm recovery-code regeneration',
    description:
      'Consumes the emailed code, replaces every old recovery code, and shows new codes once.',
  })
  @ApiOkResponse({
    description: 'Old recovery codes were invalidated and replacements were returned once.',
    content: recoveryCodesContent,
  })
  @ApiUnauthorizedResponse({
    description: 'The challenge/code is invalid, expired, or has exceeded its attempt limit.',
    content: twoStepConfirmationErrorContent(
      `${AUTH_PATH}/two-step/recovery-codes/regenerate/confirm`,
    ),
  })
  @ApiUnprocessableEntityResponse({
    description: 'The challenge token or code failed validation.',
    content: validationContent(`${AUTH_PATH}/two-step/recovery-codes/regenerate/confirm`),
  })
  public confirmRecoveryCodeRegeneration(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: TwoStepCodeConfirmationDto,
  ): Promise<RecoveryCodesResponseDto> {
    return this.service.regenerateRecoveryCodes(principal.userId, body.challengeToken, body.code);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireAuthenticated()
  @ApiOperation({
    summary: 'Log out the current session',
    description: 'Revokes the authenticated session and all of its refresh tokens.',
  })
  @ApiNoContentResponse({
    description: 'The current session was revoked.',
    content: { 'application/json': { example: null } },
  })
  @ApiUnauthorizedResponse({
    description: 'No valid authenticated session was supplied.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required', `${AUTH_PATH}/logout`),
  })
  public logout(@CurrentPrincipal() principal: AuthenticatedPrincipal): Promise<void> {
    return this.service.logout(principal.sessionId, principal.userId);
  }
}
