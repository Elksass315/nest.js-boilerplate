import type { ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';
import { firstValueFrom, of } from 'rxjs';

import { RequestContextService } from '@/core/request-context/request-context.service';

import { ApiResponseInterceptor } from './api-response.interceptor';

describe(ApiResponseInterceptor.name, () => {
  function createContext(method = 'GET', statusCode = 200): ExecutionContext {
    const request = { method, requestId: 'request-1', correlationId: 'correlation-1' } as Request;
    const response = {
      statusCode,
      headersSent: false,
      getHeader: jest.fn().mockReturnValue(undefined),
    } as unknown as Response;
    return {
      switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
    } as ExecutionContext;
  }

  it('wraps JSON success data with request metadata', async () => {
    const context = new RequestContextService();
    const result = await firstValueFrom(
      new ApiResponseInterceptor(context).intercept(createContext(), {
        handle: () => of({ id: 1 }),
      }),
    );

    expect(result).toEqual({
      success: true,
      meta: {
        requestId: 'request-1',
        correlationId: 'correlation-1',
        timestamp: expect.any(String),
      },
      data: { id: 1 },
    });
  });

  it('preserves no-content and head responses', async () => {
    const interceptor = new ApiResponseInterceptor(new RequestContextService());
    await expect(
      firstValueFrom(
        interceptor.intercept(createContext('DELETE', 204), { handle: () => of(undefined) }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      firstValueFrom(interceptor.intercept(createContext('HEAD'), { handle: () => of(undefined) })),
    ).resolves.toBeUndefined();
  });
});
