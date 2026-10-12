import { CertificationCatalogVersionDto } from '@edanalytics/models';

/** "5.2.0" -> "v5"; undefined when the version has no leading number. */
export const toDataStandardMajor = (odsDsVersion: string | undefined) => {
  const major = /^\s*v?(\d+)/i.exec(odsDsVersion ?? '')?.[1];
  return major === undefined ? undefined : `v${Number(major)}`;
};

const compareVersions = (a: string, b: string) => {
  const parts = (value: string) =>
    value
      .replace(/^v/i, '')
      .split('.')
      .map((part) => Number.parseInt(part, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

/** The active catalog version for the data standard, preferring the highest artifact version. */
export const selectCatalogVersion = (
  versions: CertificationCatalogVersionDto[],
  dataStandardVersion: string | undefined,
) =>
  dataStandardVersion === undefined
    ? undefined
    : versions
        .filter(
          (version) =>
            version.isActive &&
            version.dataStandardVersion.toLowerCase() === dataStandardVersion.toLowerCase(),
        )
        .sort((a, b) => compareVersions(b.artifactVersion, a.artifactVersion))[0];

export const byDisplayOrder = <T extends { displayOrder: number }>(items: T[]) =>
  [...items].sort((a, b) => a.displayOrder - b.displayOrder);

export const displayNameOf = (item: { displayName: string | null; name: string }) =>
  item.displayName?.trim() || item.name;
