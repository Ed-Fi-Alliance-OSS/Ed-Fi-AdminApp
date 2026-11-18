import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { CertificationRun } from './cert-certification-run.entity';

describe('CertificationRun', () => {
  it('lets the database default statusChangedAt, matching the migrations', () => {
    const column = getMetadataArgsStorage().columns.find(
      (args) => args.target === CertificationRun && args.propertyName === 'statusChangedAt',
    );
    expect(typeof column?.options.default).toBe('function');
  });

  it('declares submittedAt as a nullable column', () => {
    const column = getMetadataArgsStorage().columns.find(
      (args) => args.target === CertificationRun && args.propertyName === 'submittedAt',
    );
    expect(column?.options.nullable).toBe(true);
  });
});
