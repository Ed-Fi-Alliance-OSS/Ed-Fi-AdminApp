import {
  IWorkflowFailureErrors,
  StatusType,
  VALIDATION_RESP_TYPE,
  WORKFLOW_FAILURE_RESP_TYPE,
} from '@edanalytics/utils';
import { UseFormSetError } from 'react-hook-form';

/** Populate `onError` with standard error surfacing behavior */
export const mutationErrCallback = ({
  setError,
  popBanner,
  picky,
}: {
  setError?: UseFormSetError<any>;
  popBanner?: (banner: IWorkflowFailureErrors) => void;
  /** Only pop banners for explicitly surfaced errors (not general 500s and 400s) */
  picky?: boolean;
}) => ({
  onError: (err: any) => {
    if (setError && err?.type === VALIDATION_RESP_TYPE) {
      Object.entries(err?.errors ?? {}).forEach(([field, error]) => {
        setError(field as any, error as any);
      });
    } else if (popBanner && err?.type === WORKFLOW_FAILURE_RESP_TYPE) {
      popBanner(err.errors);
    } else if (!picky && popBanner && err.statusCode && err.message) {
      popBanner({ title: err.message, status: StatusType.error });
    } else {
      throw err;
    }
  },
});
