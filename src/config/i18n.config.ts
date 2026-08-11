import Joi from 'joi';

import type { I18nConfig } from './configuration.types';
import { readString } from './environment-reader';

const LANGUAGE_PATTERN = /^[a-z]{2}(?:-[a-z]{2})?$/;

export const i18nEnvironmentSchema = {
  APP_FALLBACK_LANGUAGE: Joi.string().lowercase().pattern(LANGUAGE_PATTERN).default('en'),
  APP_SUPPORTED_LANGUAGES: Joi.string().default('en'),
  APP_HEADER_LANGUAGE: Joi.string()
    .lowercase()
    .pattern(/^[a-z][a-z0-9-]*$/)
    .default('x-custom-lang'),
} satisfies Record<string, Joi.Schema>;

export function parseSupportedLanguages(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((language) => language.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function createI18nConfig(environment: Record<string, unknown>): I18nConfig {
  return {
    fallbackLanguage: readString(environment, 'APP_FALLBACK_LANGUAGE'),
    supportedLanguages: parseSupportedLanguages(readString(environment, 'APP_SUPPORTED_LANGUAGES')),
    headerLanguage: readString(environment, 'APP_HEADER_LANGUAGE'),
  };
}
