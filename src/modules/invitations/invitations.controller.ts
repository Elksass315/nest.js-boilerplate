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
  UseGuards,
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
import {
  CurrentPrincipal,
  PermissionsGuard,
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
  statusCode: number,
  code: string,
  message: string,
  route = path,
  details?: Record<string, unknown>,
): Record<string, unknown> => ({
  statusCode,
  code,
  message,
  timestamp: '2026-08-18T12:00:00.000Z',
  path: route,
  requestId: 'req_team_invitation_example',
  correlationId: 'corr_team_invitation_example',
  ...(details ? { details } : {}),
});
const errorContent = (
  statusCode: number,
  code: string,
  message: string,
  route = path,
  details?: Record<string, unknown>,
): Record<string, { example: Record<string, unknown> }> => ({
  'application/json': { example: errorExample(statusCode, code, message, route, details) },
});

@ApiTags('team invitations')
@UseGuards(PermissionsGuard)
@Controller({ path: 'team/invitations', version: API_VERSION })
export class InvitationsController {
  public constructor(private readonly service: InvitationsService) {}

  @Post('accept')
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
    content: errorContent(
      401,
      'INVALID_INVITATION_TOKEN',
      'The invitation token is invalid',
      `${path}/accept`,
    ),
  })
  @ApiGoneResponse({
    description: 'The otherwise valid invitation has expired.',
    content: errorContent(
      410,
      'INVITATION_EXPIRED',
      'The invitation has expired',
      `${path}/accept`,
    ),
  })
  @ApiConflictResponse({
    description: 'The invitation is terminal or its email is already registered.',
    content: {
      'application/json': {
        examples: {
          notPending: {
            summary: 'The invitation was revoked or accepted',
            value: errorExample(
              409,
              'INVITATION_NOT_PENDING',
              'The invitation is no longer pending',
              `${path}/accept`,
            ),
          },
          memberExists: {
            summary: 'The invited email became registered before acceptance',
            value: errorExample(
              409,
              'MEMBER_ALREADY_EXISTS',
              'A member with this email already exists',
              `${path}/accept`,
            ),
          },
        },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'The token, full name, or password failed DTO validation.',
    content: errorContent(422, 'VALIDATION_ERROR', 'Input validation failed', `${path}/accept`, {
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
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot create invitations or assign the requested role.',
    content: {
      'application/json': {
        examples: {
          missingPermission: {
            summary: 'Invitation creation is not permitted',
            value: errorExample(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
          },
          roleAssignment: {
            summary: 'The requested role exceeds the inviter authority',
            value: errorExample(
              403,
              'ROLE_ASSIGNMENT_FORBIDDEN',
              'You are not allowed to assign the requested role',
            ),
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
            value: errorExample(
              409,
              'MEMBER_ALREADY_EXISTS',
              'A member with this email already exists',
            ),
          },
          pendingInvitation: {
            summary: 'An active invitation already exists',
            value: errorExample(
              409,
              'INVITATION_ALREADY_PENDING',
              'A pending invitation already exists for this email',
            ),
          },
        },
      },
    },
  })
  @ApiUnprocessableEntityResponse({
    description: 'The email or role failed DTO validation.',
    content: errorContent(422, 'VALIDATION_ERROR', 'Input validation failed', path, {
      fields: { email: ['email must be an email'] },
    }),
  })
  @ApiServiceUnavailableResponse({
    description: 'The invitation was stored but its email could not be queued.',
    content: errorContent(
      503,
      'INVITATION_DELIVERY_UNAVAILABLE',
      'The invitation email could not be queued',
    ),
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
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot inspect invitations.',
    content: errorContent(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiUnprocessableEntityResponse({
    description: 'Page or limit failed validation.',
    content: errorContent(422, 'VALIDATION_ERROR', 'Input validation failed', path, {
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
    content: errorContent(400, 'BAD_REQUEST', 'The request could not be processed'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot inspect invitations.',
    content: errorContent(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiNotFoundResponse({
    description: 'The invitation does not exist.',
    content: errorContent(404, 'INVITATION_NOT_FOUND', 'The requested invitation was not found'),
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
    content: errorContent(400, 'BAD_REQUEST', 'The request could not be processed'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot resend invitations.',
    content: errorContent(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiNotFoundResponse({
    description: 'The invitation does not exist.',
    content: errorContent(404, 'INVITATION_NOT_FOUND', 'The requested invitation was not found'),
  })
  @ApiGoneResponse({
    description: 'The invitation expired before the resend request.',
    content: errorContent(410, 'INVITATION_EXPIRED', 'The invitation has expired'),
  })
  @ApiConflictResponse({
    description: 'The invitation is terminal, too recent, or has reached its send limit.',
    content: {
      'application/json': {
        examples: {
          notPending: {
            summary: 'Only pending invitations can be resent',
            value: errorExample(
              409,
              'INVITATION_NOT_PENDING',
              'The invitation is no longer pending',
            ),
          },
          tooSoon: {
            summary: 'The resend cooldown is active',
            value: errorExample(
              409,
              'INVITATION_RESEND_TOO_SOON',
              'Wait before resending this invitation',
            ),
          },
          sendLimit: {
            summary: 'The invitation reached its send limit',
            value: errorExample(
              409,
              'INVITATION_RESEND_LIMIT_REACHED',
              'The invitation resend limit has been reached',
            ),
          },
        },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    description: 'The rotated invitation email could not be queued.',
    content: errorContent(
      503,
      'INVITATION_DELIVERY_UNAVAILABLE',
      'The invitation email could not be queued',
    ),
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
    content: errorContent(400, 'BAD_REQUEST', 'The request could not be processed'),
  })
  @ApiUnauthorizedResponse({
    description: 'No authenticated principal was provided.',
    content: errorContent(401, 'UNAUTHORIZED', 'Authentication is required'),
  })
  @ApiForbiddenResponse({
    description: 'The principal cannot revoke invitations.',
    content: errorContent(403, 'FORBIDDEN', 'You are not allowed to perform this action'),
  })
  @ApiNotFoundResponse({
    description: 'The invitation does not exist.',
    content: errorContent(404, 'INVITATION_NOT_FOUND', 'The requested invitation was not found'),
  })
  @ApiConflictResponse({
    description: 'An accepted or expired invitation cannot be revoked.',
    content: errorContent(409, 'INVITATION_NOT_PENDING', 'The invitation is no longer pending'),
  })
  public revoke(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    return this.service.revoke(id, principal);
  }
}
