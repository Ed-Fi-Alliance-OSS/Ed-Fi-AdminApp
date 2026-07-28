import 'reflect-metadata';
import { validate } from 'class-validator';
import { PostDbInstanceDtoV2 } from './edfi-admin-api.v2.dto';

describe('PostDbInstanceDtoV2', () => {
  it('requires name and databaseTemplate', async () => {
    const dto = new PostDbInstanceDtoV2();
    const result = await validate(dto);
    const fieldsWithErrors = result.map((error) => error.property);

    expect(fieldsWithErrors).toContain('name');
    expect(fieldsWithErrors).toContain('databaseTemplate');
  });

  it('accepts name and databaseTemplate', async () => {
    const dto = Object.assign(new PostDbInstanceDtoV2(), {
      name: 'My DB Instance',
      databaseTemplate: 'Minimal',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
