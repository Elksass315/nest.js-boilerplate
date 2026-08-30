import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiGoneResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { API_VERSION } from '@/common/http/api-version.constants';
import {
  ApiOffsetPaginatedResponse,
  OffsetPaginationQueryDto,
  type OffsetPage,
} from '@/common/pagination';
import { swaggerErrorContent, swaggerErrorExample } from '@/common/swagger/api-error-response';
import type { ErrorCode } from '@/core/errors/error-definitions';
import {
  CurrentPrincipal,
  Public,
  RequirePermissions,
  type AuthenticatedPrincipal,
} from '@/modules/authorization';

import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InvitationAcceptedResponseDto } from './dto/invitation-accepted-response.dto';
import { InvitationResponseDto } from './dto/invitation-response.dto';
import { InvitationsService } from './invitations.service';

const path = '/api/v1/team/invitations';
const invitationExample = {
  id: '516f56de-a801-47ea-b178-6d64b55da325',
  email: 'new.member@example.com',
  role: 'user',
  status: 'pending',
  invitedByUserId: '889e25cb-ded9-4eb8-a2d6-8f058cc96580',
  expiresAt: '2026-08-21T12:00:00.000Z',
  lastSentAt: '2026-08-18T12:00:00.000Z',
  sendCount: 1,
  createdAt: '2026-08-18T12:00:00.000Z',
  updatedAt: '2026-08-18T12:00:00.000Z',
};
const invitationContent = { 'application/json': { example: invitationExample } };
const errorExample = (
  code: ErrorCode,
  route = path,
  details?: Record<string, unknown>,
): Record<string, unknown> => swaggerErrorExample(code, route, details);
const errorContent = (
  code: ErrorCode,
  route = path,
  details?: Record<string, unknown>,
): Record<string, { example: Record<string, unknown> }> =>
  swaggerErrorContent(code, route, details);

@ApiTags('team invitations')
@Controller({ path: 'team/invitations', version: API_VERSION })
export class InvitationsController {
  public constructor(private readonly service: InvitationsService) {}

  @Post('accept')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Accept a team invitation',
    description:
      'Consumes one valid invitation token, creates an active verified account with the invited role, and does not create a login session.',
  })
  @ApiCreatedResponse({
    description: 'The invitation was consumed and the active account was created.',
    content: {
      'application/json': {
        example: { message: 'Invitation accepted' },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'The invitation token is unknown or was replaced by a resend or prior acceptance.',
    content: errorContent('INVALID_INVITATION_TOKEN', `${path}/accept`),
  })
  @ApiGoneResponse({
    description: 'The otherwise valid invitation has expired.',
    content: errorContent('INVITATION_EXPIRED', `${path}/accept`),
  })
  @ApiConflictResponse({
    description: 'The invitation is terminal or its email is already registered.',
    content: {
      'application/json': {
        examples: {
          notPending: {
            summary: 'The invitation was revoked or accepted',
            value: errorExample('INVITATION_NOT_PENDING', `${path}/accept`),
          },
          memberExists: {
            summary: 'The invited email became registered before acceptance',
            value: errorExample('MEMBER_ALREADY_EXISTS', `${path}/accept`),
          },
        },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'The token, full name, or password failed DTO validation.',
    content: errorContent('VALIDATION_ERROR', `${path}/accept`, {
      fields: { password: ['password must be longer than or equal to 12 characters'] },
    }),
  })
  public async accept(@Body() body: AcceptInvitationDto): Promise<InvitationAcceptedResponseDto> {
    await this.service.accept(body.token, body.fullName, body.password);
    return { message: 'Invitation accepted' };
  }

  @Post()
  @RequirePermissions('team.invitations.create')
  @ApiOperation({
    summary: 'Invite a team member',
    description:
      'Creates one expiring invitation, enforces role-assignment authority, queues a correlated email, and returns no token.',
  })
  @ApiCreatedResponse({
    description: 'The invitation was created and queued.',
    content: invitationContent,
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot create invitations or assign the requested role.',
    content: {
      'application/json': {
        examples: {
          missingPermission: {
            summary: 'Invitation creation is not permitted',
            value: errorExample('FORBIDDEN'),
          },
          roleAssignment: {
            summary: 'The requested role exceeds the inviter authority',
            value: errorExample('ROLE_ASSIGNMENT_FORBIDDEN'),
          },
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'The email already belongs to a member or has an active invitation.',
    content: {
      'application/json': {
        examples: {
          memberExists: {
            summary: 'A member already owns the email',
            value: errorExample('MEMBER_ALREADY_EXISTS'),
          },
          pendingInvitation: {
            summary: 'An active invitation already exists',
            value: errorExample('INVITATION_ALREADY_PENDING'),
          },
        },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'The email or role failed DTO validation.',
    content: errorContent('VALIDATION_ERROR', path, {
      fields: { email: ['email must be an email'] },
    }),
  })
  @ApiServiceUnavailableResponse({
    description: 'The invitation was stored but its email could not be queued.',
    content: errorContent('INVITATION_DELIVERY_UNAVAILABLE'),
  })
  public create(
    @Body() body: CreateInvitationDto,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<InvitationResponseDto> {
    return this.service.create(body.email, body.role, principal);
  }

  @Get()
  @RequirePermissions('team.invitations.read')
  @ApiOperation({
    summary: 'List team invitations',
    description: 'Returns a bounded offset page ordered by newest invitation first.',
  })
  @ApiOffsetPaginatedResponse(InvitationResponseDto, 'The requested invitation page was returned.')
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot inspect invitations.',
    content: errorContent('FORBIDDEN'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Page or limit failed validation.',
    content: errorContent('VALIDATION_ERROR', path, {
      fields: { page: ['page must not be less than 1'] },
    }),
  })
  public list(
    @Query() query: OffsetPaginationQueryDto,
  ): Promise<OffsetPage<InvitationResponseDto>> {
    return this.service.list(query.page, query.limit);
  }

  @Get(':id')
  @RequirePermissions('team.invitations.read')
  @ApiOperation({
    summary: 'Get a team invitation',
    description: 'Returns one invitation without exposing its token hash.',
  })
  @ApiOkResponse({ description: 'The invitation was returned.', content: invitationContent })
  @ApiBadRequestResponse({
    description: 'The invitation identifier is not a UUID.',
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot inspect invitations.',
    content: errorContent('FORBIDDEN'),
  })
  @ApiNotFoundResponse({
    description: 'The invitation does not exist.',
    content: errorContent('INVITATION_NOT_FOUND'),
  })
  public getById(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<InvitationResponseDto> {
    return this.service.getById(id);
  }

  @Post(':id/resend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('team.invitations.resend')
  @ApiOperation({
    summary: 'Resend a team invitation',
    description:
      'Rotates the single-use token, extends expiration, enforces cooldown and send limits, and queues a correlated email.',
  })
  @ApiOkResponse({
    description: 'The invitation token was rotated and email queued.',
    content: invitationContent,
  })
  @ApiBadRequestResponse({
    description: 'The invitation identifier is not a UUID.',
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot resend invitations.',
    content: errorContent('FORBIDDEN'),
  })
  @ApiNotFoundResponse({
    description: 'The invitation does not exist.',
    content: errorContent('INVITATION_NOT_FOUND'),
  })
  @ApiGoneResponse({
    description: 'The invitation expired before the resend request.',
    content: errorContent('INVITATION_EXPIRED'),
  })
  @ApiConflictResponse({
    description: 'The invitation is terminal, too recent, or has reached its send limit.',
    content: {
      'application/json': {
        examples: {
          notPending: {
            summary: 'Only pending invitations can be resent',
            value: errorExample('INVITATION_NOT_PENDING'),
          },
          tooSoon: {
            summary: 'The resend cooldown is active',
            value: errorExample('INVITATION_RESEND_TOO_SOON'),
          },
          sendLimit: {
            summary: 'The invitation reached its send limit',
            value: errorExample('INVITATION_RESEND_LIMIT_REACHED'),
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'The rotated invitation email could not be queued.',
    content: errorContent('INVITATION_DELIVERY_UNAVAILABLE'),
  })
  public resend(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<InvitationResponseDto> {
    return this.service.resend(id, principal);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('team.invitations.revoke')
  @ApiOperation({
    summary: 'Revoke a team invitation',
    description:
      'Revokes a pending invitation idempotently and records a correlated security audit.',
  })
  @ApiNoContentResponse({
    description: 'The pending invitation was revoked or was already revoked.',
    content: { 'application/json': { example: null } },
  })
  @ApiBadRequestResponse({
    description: 'The invitation identifier is not a UUID.',
    content: errorContent('BAD_REQUEST'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent('UNAUTHORIZED'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot revoke invitations.',
    content: errorContent('FORBIDDEN'),
  })
  @ApiNotFoundResponse({
    description: 'The invitation does not exist.',
    content: errorContent('INVITATION_NOT_FOUND'),
  })
  @ApiConflictResponse({
    description: 'An accepted or expired invitation cannot be revoked.',
    content: errorContent('INVITATION_NOT_PENDING'),
  })
  public revoke(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    return this.service.revoke(id, principal);
  }
}
