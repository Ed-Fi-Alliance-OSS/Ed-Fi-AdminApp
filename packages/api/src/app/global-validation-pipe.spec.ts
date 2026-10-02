import 'reflect-metadata';
import { ArgumentMetadata } from '@nestjs/common';
import {
  ImportClaimsetSingleDtoV2,
  PostTeamDto,
  PostUserTeamMembershipDto,
  PutUserTeamMembershipDto,
} from '@edanalytics/models';
import { CustomHttpException } from '../utils/customExceptions';
import { createGlobalValidationPipe } from './global-validation-pipe';

const bodyOf = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
  type: 'body',
  metatype,
  data: undefined,
});

describe('createGlobalValidationPipe', () => {
  const pipe = createGlobalValidationPipe();

  it('strips an injected primary key from a create body', async () => {
    const result = await pipe.transform(
      { id: 7, teamId: 1, userId: 2, roleId: 3 },
      bodyOf(PostUserTeamMembershipDto)
    );

    expect(result).toBeInstanceOf(PostUserTeamMembershipDto);
    expect(result).toEqual({ teamId: 1, userId: 2, roleId: 3 });
    expect(result).not.toHaveProperty('id');
  });

  it('strips server-controlled audit columns and undeclared properties', async () => {
    const result = await pipe.transform(
      { name: 'New team', createdById: 99, modifiedById: 99, isAdmin: true },
      bodyOf(PostTeamDto)
    );

    expect(result).toEqual({ name: 'New team' });
  });

  it('leaves unsent optional properties absent so partial updates do not clear columns', async () => {
    const result = await pipe.transform({ id: 1 }, bodyOf(PutUserTeamMembershipDto));

    expect(Object.keys(result)).toEqual([]);
  });

  it('keeps exposed properties of nested DTOs', async () => {
    const body = {
      name: 'Imported',
      resourceClaims: [
        {
          id: 'rc-1',
          name: 'students',
          actions: [{ name: 'Read', enabled: true, extra: 'dropped' }],
          authorizationStrategyOverridesForCRUD: [],
          children: [],
        },
      ],
    };

    const result = await pipe.transform(body, bodyOf(ImportClaimsetSingleDtoV2));

    expect(result.resourceClaims[0]).toMatchObject({
      id: 'rc-1',
      name: 'students',
      actions: [{ name: 'Read', enabled: true }],
    });
    expect(result.resourceClaims[0].actions[0]).not.toHaveProperty('extra');
  });

  it('still rejects invalid bodies with the existing validation error shape', async () => {
    await expect(
      pipe.transform({ teamId: 'not-a-number', userId: 2 }, bodyOf(PostUserTeamMembershipDto))
    ).rejects.toBeInstanceOf(CustomHttpException);
  });
});
