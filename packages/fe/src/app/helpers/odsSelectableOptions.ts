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
 * status) so a form that already has a value selected doesn't lose it.
 *
 * Retention depends on whether the caller passes `selectedValue` at all, not on
 * whether the page is "create" or "edit". `SelectOds` only forwards a
 * `selectedValue` for its explicit `value`/`onChange` overload, which is used
 * by Edit Application/API Client *and* Create Application/API Client
 * (`value={selectedOds}`). The create pages currently show no visible effect
 * from this only because they start with `selectedOds === undefined` — if a
 * future feature prefills that value (e.g. duplicating an application), an
 * unavailable prefilled ODS would be retained here too. Callers using the
 * React Hook Form `control`/`name` overload instead (e.g. Create Ed-Org,
 * Create Ownership) never pass a `selectedValue` into this helper, so an
 * unavailable ODS is always filtered out for them.
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
