import { AsyncLocalStorage } from 'node:async_hooks';

import { Injectable } from '@nestjs/common';

export interface RequestContext {
  requestId: string;
  correlationId: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  public run(context: RequestContext, callback: () => void): void {
    this.storage.run(context, callback);
  }

  public get(): RequestContext | undefined {
    return this.storage.getStore();
  }

  public getRequestId(): string | undefined {
    return this.get()?.requestId;
  }

  public getCorrelationId(): string | undefined {
    return this.get()?.correlationId;
  }
}
