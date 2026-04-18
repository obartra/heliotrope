import { RuleTester } from 'eslint';
import { describe, it } from 'vitest';
import plugin from './index.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2022, ecmaFeatures: { jsx: true } },
});

ruleTester.run('no-em-dash', plugin.rules['no-em-dash'], {
  valid: [
    { code: `const x = 'hello world';` },
    { code: 'const x = `hello ${name}`;' },
    { code: '// normal comment with a hyphen-dash' },
    { code: '/* block comment without em dash */' },
    { code: '<p>hello world</p>;' },
    { code: `const x = 'en dash is fine: -';` },
  ],

  invalid: [
    {
      code: `const x = 'hello \u2014 world';`,
      errors: [{ messageId: 'noEmDash' }],
    },
    {
      code: 'const x = `template \u2014 literal`;',
      errors: [{ messageId: 'noEmDash' }],
    },
    {
      code: '<p>text \u2014 here</p>;',
      errors: [{ messageId: 'noEmDash' }],
    },
    {
      code: '// comment with \u2014 em dash',
      errors: [{ messageId: 'noEmDash' }],
    },
    {
      code: '/* block \u2014 comment */',
      errors: [{ messageId: 'noEmDash' }],
    },
  ],
});
