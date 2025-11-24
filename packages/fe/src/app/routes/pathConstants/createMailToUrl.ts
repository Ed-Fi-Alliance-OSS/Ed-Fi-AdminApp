type MailToProps = {
  email: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body?: string;
};

export const createMailToUrl = ({ email, cc, bcc, subject, body }: MailToProps): string => {
  const params = { cc, bcc, subject, body };

  const queryString = Object.entries(params)
    .filter(([, value]) => !!value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value as string)}`)
    .join('&');

  return `mailto:${email}?${queryString}`;
};
