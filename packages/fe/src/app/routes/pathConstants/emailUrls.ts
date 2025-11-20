import { createMailToUrl } from './createMailToUrl';

const reportIssueBody = (districtName?: string) =>
  `
Hello EA Support team,

Please see the below information on how I need assistance:

• My name is:
• My district is: ${districtName ? districtName : ''}
• The product I need help with is:
• A summary of the question (or issue) is:

I have provided any relevant screenshots, error messages, or information to help your support team remedy this issue or answer this question.

Thank you,
`.trim();

export function reportIssue(districtName?: string) {
  let subject = 'Support requested ';
  if (districtName) subject += `from ${districtName} `;
  subject += 'for StartingBlocks / StartingBlocks Admin App';

  return createMailToUrl({
    email: 'support@edanalytics.org',
    subject,
    body: reportIssueBody(districtName),
  });
}
