export const MAINTENANCE_CAPABILITY_CLEANER = Symbol('MAINTENANCE_CAPABILITY_CLEANER');

export interface MaintenanceCapabilityCleaner {
  readonly name: string;
  cleanup(now: Date, limit: number): Promise<number>;
}
