export default {
  '*.{ts,mjs,cjs}': ['prettier --write', 'eslint --fix'],
  '*.{json,md,yml,yaml}': ['prettier --write'],
};
