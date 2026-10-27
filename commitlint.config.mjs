export default {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        // ADR-0009: cada commit es lliga a Taiga. Admet diverses tasques: `Refs: TG-88, TG-91`.
        'refs-taiga': ({ raw }) => [
          /^Refs: TG-\d+(, TG-\d+)*$/m.test(raw ?? ''),
          'falta el peu "Refs: TG-<ref>" (p. ex. Refs: TG-67)',
        ],
      },
    },
  ],
  rules: {
    'header-max-length': [2, 'always', 72],
    'refs-taiga': [2, 'always'],
  },
};
