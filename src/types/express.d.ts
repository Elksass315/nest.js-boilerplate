declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      correlationId?: string;
      i18nLang?: string;
    }
  }
}

export {};
