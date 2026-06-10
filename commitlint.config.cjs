module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'subject-case': [2, 'always', ['sentence-case', 'lower-case']],
    'body-max-line-length': [1, 'always', 120],
    'footer-max-line-length': [1, 'always', 120],
    'header-max-length': [2, 'always', 100],
  },
};
