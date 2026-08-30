import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { ReadinessRegistry } from '@/health/readiness-registry.service';

import { FilesService } from './files.service';

@Injectable()
export class FilesReadinessService implements OnModuleInit, OnModuleDestroy {
  private unregister?: () => void;

  public constructor(
    private readonly registry: ReadinessRegistry,
    private readonly files: FilesService,
  ) {}

  public onModuleInit(): void {
    this.unregister = this.registry.register('storage', () => this.files.checkStorageHealth());
  }

  public onModuleDestroy(): void {
    this.unregister?.();
  }
}
