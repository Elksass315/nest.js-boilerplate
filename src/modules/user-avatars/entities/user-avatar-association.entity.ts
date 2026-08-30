import { Column, Entity, Index, Unique } from 'typeorm';

import { AppBaseEntity } from '@/shared/entities/app-base.entity';

@Entity({ name: 'user_avatar_associations' })
@Unique('UQ_user_avatar_associations_user_id', ['userId'])
@Unique('UQ_user_avatar_associations_file_id', ['fileId'])
@Index('IDX_user_avatar_associations_file_id', ['fileId'])
export class UserAvatarAssociationEntity extends AppBaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  public userId!: string;

  @Column({ name: 'file_id', type: 'uuid' })
  public fileId!: string;
}
