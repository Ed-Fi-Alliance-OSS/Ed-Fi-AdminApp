const ALLOWED_DIRECTIVE =
  /^(eslint-disable(-next-line|-line)?(\s|$)|@ts-expect-error\b|\/\s*<reference\b)/;

const rule = {
  meta: {
    type: 'suggestion',
    schema: [],
    messages: {
      noComment:
        'Comments are not allowed. Express intent in names, types or tests. Only lint/TS directives with a reason are permitted.',
    },
  },
  create(context) {
    return {
      'Program:exit'() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === 'Shebang') continue;
          if (ALLOWED_DIRECTIVE.test(comment.value.trim())) continue;
          context.report({ loc: comment.loc, messageId: 'noComment' });
        }
      },
    };
  },
};

export default rule;
