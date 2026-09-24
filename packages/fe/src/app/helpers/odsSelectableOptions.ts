type SelectableOds = { status: string | null; displayName: string };
type OdsOptionKey = number | string | null;

/**
 * An ODS instance (v2) / data store (v3) is available for selection when it is
 * `Created`, or when the Admin API did not report a status at all (`null`).
 */
export const isOdsAvailable = (ods: Pick<SelectableOds, 'status'>) =>
  ods.status === null || ods.status === 'Created';

/**
 * Builds dropdown options containing only available ODS rows. The row matching
 * `selectedValue` is kept even when unavailable (its label suffixed with its
 * status) so edit forms don't lose a record's saved ODS.
 *
 * `SelectOds` only passes `selectedValue` for the explicit `value`/`onChange`
 * overload (edit pages). The React Hook Form `control`/`name` overload (create
 * pages) gets filtering alone, so an unavailable prefilled ODS is intentionally
 * dropped and cleared — nothing should be created against it.
 */
export const buildOdsSelectOptions = <T extends SelectableOds>(
  odss: T[],
  getKey: (ods: T) => OdsOptionKey,
  selectedValue: number | string | null | undefined,
) =>
  Object.fromEntries(
    odss.flatMap((ods) => {
      const key = getKey(ods);
      const isSelected =
        selectedValue !== undefined &&
        selectedValue !== null &&
        String(key) === String(selectedValue);
      if (isOdsAvailable(ods)) {
        return [[key, { value: key, label: ods.displayName }]];
      }
      if (isSelected) {
        return [[key, { value: key, label: `${ods.displayName} (${ods.status})` }]];
      }
      return [];
    }),
  ) as Record<string, { value: number | string; label: string }>;
