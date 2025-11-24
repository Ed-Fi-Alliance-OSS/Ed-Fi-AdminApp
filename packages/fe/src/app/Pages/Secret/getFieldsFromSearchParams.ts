import { DEFAULT_SECRET_FIELDS, type SecretFields } from '@edanalytics/common-ui';

/**
 * Gets key and text from searchParams for multiple secret fields
 * @param search a string with a fields key in the format of key,text;key,text
 * @returns an array of objects with key and text keys
 */
export function getFieldsFromSearchParams(search: string): SecretFields {
  if (!search) return DEFAULT_SECRET_FIELDS;

  const searchParams = new URLSearchParams(search);
  const fields = searchParams.get('fields');
  if (!fields) return DEFAULT_SECRET_FIELDS;

  return fields.split(';').map((field) => {
    const [key, label, ...booleanProps] = field.split(',');
    const booleans = Object.fromEntries(booleanProps.map((name) => [name, true]));
    return { key, label, booleans };
  });
}
