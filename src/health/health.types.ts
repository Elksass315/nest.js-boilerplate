export interface LivenessResponse {
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadinessResponse {
  status: 'ok';
  timestamp: string;
  checks: {
    database: 'up';
    redis: 'up';
  };
}
