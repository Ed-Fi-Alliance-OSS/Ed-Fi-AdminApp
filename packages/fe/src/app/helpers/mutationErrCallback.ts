import {
  StatusResponse,
  isFormValidationError,
  isExplicitStatusResponse,
} from '@edanalytics/utils';
import { UseFormSetError } from 'react-hook-form';

/**
 * Populate mutation `onError` with standard error surfacing behavior. Uses form state if available, otherwise pops a banner.
 * - Explicit form validation errors
 * - Explicit return status messages
 * - General HTTP errors
 *
 * Note: wherever the API has explicit validation logic or error handling, it mostly returns the special
 * form validation objects or status messages, as appropriate. The generic HTTP failures are left for cases in which
 * either (a) errors aren't handled by any explicit logic (so the initial exception goes all the way to Nest's
 * global filter), or (b) there's nothing we want to say or do about the error (e.g. a 404).
 *
 * */
export const mutationErrCallback = ({
  setFormError,
  popGlobalBanner,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormError?: UseFormSetError<any>;
  popGlobalBanner?: (banner: StatusResponse) => void;
}) => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onError: (err: any) => {
    console.log(err);

    if (setFormError && isFormValidationError(err)) {
      Object.entries(err.data.errors).forEach(([field, error]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFormError(field, error as any);
      });
    } else if (popGlobalBanner) {
      if (isExplicitStatusResponse(err)) {
        popGlobalBanner(err);
      } else if (err.statusCode && err.message) {
        popGlobalBanner({ title: err.message, message: String(err.statusCode), type: 'Error' });
      }
    } else {
      throw err;
    }
  },
});
