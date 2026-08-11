module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-controller-to-repository',
      severity: 'error',
      from: { path: '\\.controller\\.ts$' },
      to: { path: '\\.repository\\.ts$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.(spec|e2e-spec)\\.ts$' },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'] },
  },
};
