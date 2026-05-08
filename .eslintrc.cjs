module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {
    'no-unused-vars': ['warn', { args: 'none', ignoreRestSiblings: true }],
    'prefer-const': 'warn',
    'consistent-return': 'warn',
  },
  ignorePatterns: ['node_modules/', '.git/', '.specstory/', 'data/'],
};
