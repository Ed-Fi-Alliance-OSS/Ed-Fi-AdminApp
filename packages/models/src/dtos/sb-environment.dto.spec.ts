import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { PostSbEnvironmentDto, PutSbEnvironmentDto } from './sb-environment.dto';

describe('SbEnvironment DTO URL normalization', () => {
  const raw = {
    odsApiDiscoveryUrl: '  https://localhost/odsv7-adminv2-single-api/  ',
    adminApiUrl: 'https://localhost/odsv7-adminv2-single-adminapi//',
  };

  it('PostSbEnvironmentDto trims surrounding whitespace and trailing slashes from both URLs', () => {
    const result = plainToInstance(PostSbEnvironmentDto, raw);
    expect(result.odsApiDiscoveryUrl).toBe('https://localhost/odsv7-adminv2-single-api');
    expect(result.adminApiUrl).toBe('https://localhost/odsv7-adminv2-single-adminapi');
  });

  it('PutSbEnvironmentDto trims surrounding whitespace and trailing slashes from both URLs', () => {
    const result = plainToInstance(PutSbEnvironmentDto, raw);
    expect(result.odsApiDiscoveryUrl).toBe('https://localhost/odsv7-adminv2-single-api');
    expect(result.adminApiUrl).toBe('https://localhost/odsv7-adminv2-single-adminapi');
  });
});
