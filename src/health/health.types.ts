export interface LivenessResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadinessResponse {
  status: 'ok';
  timestamp: string;
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    [name: string]: 'up' | 'down';
  };
}
