'use strict';

const EM_DASH = '\u2014';
const MESSAGE = 'Em dashes are not allowed. Restructure the sentence or use a hyphen.';

/** @type {import('eslint').Rule.RuleModule} */
const noEmDash = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow em dashes in strings, templates, JSX text, and comments',
    },
    schema: [],
    messages: {
      noEmDash: MESSAGE,
    },
  },
  create(context) {
    function checkValue(node, value) {
      if (typeof value === 'string' && value.includes(EM_DASH)) {
        context.report({ node, messageId: 'noEmDash' });
      }
    }

    return {
      Literal(node) {
        checkValue(node, node.value);
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          checkValue(quasi, quasi.value.raw);
        }
      },
      JSXText(node) {
        checkValue(node, node.value);
      },
      Program(node) {
        const comments = context.sourceCode.getAllComments();
        for (const comment of comments) {
          if (comment.value.includes(EM_DASH)) {
            context.report({ node: comment, messageId: 'noEmDash' });
          }
        }
      },
    };
  },
};

module.exports = {
  rules: {
    'no-em-dash': noEmDash,
  },
};
