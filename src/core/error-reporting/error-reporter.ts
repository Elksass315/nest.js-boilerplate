export const ERROR_REPORTER = Symbol('ERROR_REPORTER');

export interface ErrorReporter {
  capture(error: unknown, context: Record<string, unknown>): void;
}

export class NoopErrorReporter implements ErrorReporter {
  public capture(_error: unknown, _context: Record<string, unknown>): void {
    void _error;
    void _context;
  }
}

let startupCapture: (processName: string, error: unknown) => Promise<void> = () =>
  Promise.resolve();

export function registerStartupErrorReporter(
  capture: (processName: string, error: unknown) => Promise<void>,
): void {
  startupCapture = capture;
}

export function captureStartupFailure(processName: string, error: unknown): Promise<void> {
  return startupCapture(processName, error);
}
