import 'reflect-metadata';
import { CertificationCatalogVersionDto } from '@edanalytics/models';
import { selectCatalogVersion, toDataStandardMajor } from './certificationCatalog';

const version = (
  catalogVersionId: number,
  dataStandardVersion: string,
  artifactVersion = 'v2.1.0',
  isActive = true,
) =>
  ({
    catalogVersionId,
    dataStandardVersion,
    artifactVersion,
    isActive,
  }) as CertificationCatalogVersionDto;

describe('toDataStandardMajor', () => {
  it.each([
    ['5.2.0', 'v5'],
    ['6.1.0', 'v6'],
    ['4', 'v4'],
    ['v5.0', 'v5'],
    ['', undefined],
    [undefined, undefined],
    ['unknown', undefined],
  ])('maps %p to %p', (input, expected) => {
    expect(toDataStandardMajor(input)).toBe(expected);
  });
});

describe('selectCatalogVersion', () => {
  it('picks the version for the data standard', () => {
    expect(selectCatalogVersion([version(1, 'v4'), version(2, 'v5')], 'v5')?.catalogVersionId).toBe(
      2,
    );
  });

  it('ignores inactive versions', () => {
    expect(selectCatalogVersion([version(2, 'v5', 'v2.1.0', false)], 'v5')).toBeUndefined();
  });

  it('prefers the highest artifact version', () => {
    expect(
      selectCatalogVersion(
        [version(1, 'v5', 'v2.9.0'), version(2, 'v5', 'v2.10.0'), version(3, 'v5', 'v1.0.0')],
        'v5',
      )?.catalogVersionId,
    ).toBe(2);
  });

  it('returns undefined without a match or a data standard', () => {
    expect(selectCatalogVersion([version(1, 'v4')], 'v6')).toBeUndefined();
    expect(selectCatalogVersion([version(1, 'v4')], undefined)).toBeUndefined();
  });
});
