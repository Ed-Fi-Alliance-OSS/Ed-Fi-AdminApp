import { DEFAULT_SECRET_FIELDS, SecretValue } from './SecretValue';

export default {
  title: 'SecretValue',
  component: SecretValue,
};

export const Standard = () => (
  <SecretValue
    value={{
      key: 'twz40OsfQ1VC',
      secret: 'nbMMc1Xzlb38fshlCp2UYDjj',
      url: 'https://gbhs-test-5.mth-dev-61a.eaedfi.edanalytics.org/',
    }}
    fields={DEFAULT_SECRET_FIELDS}
  />
);
