import type { AuthorizeConfig } from '../../helpers';

/** The global privilege behind the review pages and the dashboard's Pick up and Continue. */
export const REVIEW_CERTIFICATION: AuthorizeConfig = {
  privilege: 'certification:review',
  subject: { id: '__filtered__' },
};
