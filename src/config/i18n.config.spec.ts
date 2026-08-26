import { createI18nConfig, parseSupportedLanguages } from './i18n.config';

describe('i18n configuration', () => {
  it('normalizes and deduplicates supported languages', () => {
    expect(parseSupportedLanguages('en, ar, EN, ,fr')).toEqual(['en', 'ar', 'fr']);
  });

  it('maps language settings', () => {
    expect(
      createI18nConfig({
        APP_FALLBACK_LANGUAGE: 'en',
        APP_SUPPORTED_LANGUAGES: 'en,ar',
        APP_HEADER_LANGUAGE: 'x-language',
      }),
    ).toEqual({
      fallbackLanguage: 'en',
      supportedLanguages: ['en', 'ar'],
      headerLanguage: 'x-language',
    });
  });
});
