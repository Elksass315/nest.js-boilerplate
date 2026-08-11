import {
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export abstract class AppBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  public createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  public updatedAt!: Date;
}

export abstract class SoftDeleteEntity extends AppBaseEntity {
  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  public deletedAt!: Date | null;
}
