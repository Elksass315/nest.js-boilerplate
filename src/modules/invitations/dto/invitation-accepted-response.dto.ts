import { ApiProperty } from '@nestjs/swagger';

export class InvitationAcceptedResponseDto {
  @ApiProperty({ example: 'Invitation accepted' })
  public message!: string;
}
