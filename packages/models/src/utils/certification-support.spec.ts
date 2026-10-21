import { certificationUnsupportedMessage, supportsCertification } from './certification-support';

describe('supportsCertification', () => {
  it.each([
    ['5.0.0'],
    ['5.0.1'],
    ['5.2.0'],
    ['6.0.0'],
    // String comparison would put "10.0.0" before "5.0.0".
    ['10.0.0'],
    ['5.1.0-pre'],
    ['5.0.0+build.7'],
    [' 5.0.0 '],
  ])('supports Ed-Fi data model %p', (odsDsVersion) => {
    expect(supportsCertification(odsDsVersion)).toBe(true);
  });

  it.each([
    ['4.0.0'],
    ['4.9.9'],
    ['3.3.1-b'],
    // A prerelease of 5.0.0 comes before 5.0.0.
    ['5.0.0-pre'],
  ])('does not support Ed-Fi data model %p', (odsDsVersion) => {
    expect(supportsCertification(odsDsVersion)).toBe(false);
  });

  it.each([[undefined], [''], ['unknown'], ['5'], ['5.0'], ['v5'], ['5.x.0'], ['5.0.0.1']])(
    'treats an undeterminable data model %p as unsupported',
    (odsDsVersion) => {
      expect(supportsCertification(odsDsVersion)).toBe(false);
    },
  );

  // odsApiMeta is saved verbatim from the ODS/API, so the type isn't guaranteed at runtime.
  it.each([[5], [null], [{ version: '5.0.0' }]])(
    'treats a non-string data model %p as unsupported instead of throwing',
    (odsDsVersion) => {
      expect(supportsCertification(odsDsVersion as never)).toBe(false);
    },
  );
});

describe('certificationUnsupportedMessage', () => {
  it('names the stored version and how to refresh it', () => {
    expect(certificationUnsupportedMessage('4.0.0')).toBe(
      "Certification requires Ed-Fi Data Standard 5.0.0 or later. Admin App has this environment's data standard version as 4.0.0. If its Ed-Fi API has been upgraded since the environment was connected, connect the environment again so Admin App picks up the new version.",
    );
  });

  it.each([[undefined], [''], [5 as never]])(
    'explains how to fix an unreadable version %p',
    (odsDsVersion) => {
      expect(certificationUnsupportedMessage(odsDsVersion)).toBe(
        "Certification requires Ed-Fi Data Standard 5.0.0 or later. Admin App couldn't read this environment's data standard version from its Ed-Fi API. Check the environment's Ed-Fi API Discovery URL, then connect the environment again.",
      );
    },
  );
});
