import { SpanStatusCode, trace, type Span } from '@opentelemetry/api';

const tracer = trace.getTracer('nestjs-saas');

export async function withTelemetrySpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  work: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await work(span);
    } catch (error: unknown) {
      span.recordException(error instanceof Error ? error : new Error('Unknown error'));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
