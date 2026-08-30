export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  authVersion: number;
}

export interface SessionMetadata {
  ipAddress: string | null;
  userAgent: string | null;
  device: {
    type: string | null;
    os: string | null;
    browser: string | null;
  } | null;
  location: {
    country: string | null;
    region: string | null;
    city: string | null;
  } | null;
}
