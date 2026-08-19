import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'feature_flag_audits' })
@Index('IDX_feature_flag_audits_flag_created', ['featureFlagId', 'createdAt', 'id'])
export class FeatureFlagAuditEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ name: 'feature_flag_id', type: 'uuid' })
  public featureFlagId!: string;

  @Column({ name: 'actor_user_id', type: 'uuid' })
  public actorUserId!: string;

  @Column({ name: 'previous_enabled', type: 'boolean', nullable: true })
  public previousEnabled!: boolean | null;

  @Column({ name: 'enabled', type: 'boolean' })
  public enabled!: boolean;

  @Column({ name: 'request_id', type: 'varchar', length: 128, nullable: true })
  public requestId!: string | null;

  @Column({ name: 'correlation_id', type: 'varchar', length: 128, nullable: true })
  public correlationId!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  public createdAt!: Date;
}
