import { GetUserDto } from '@edanalytics/models'

/**
 * Puts the identity of the transacting user into the `modifiedById` field of an entity to be saved. Mutates the entity argument and returns it.
 *
 * @param entity Entity (presumably a Put DTO) on which to add the user
 * @param user The transacting user
 * @returns Modified entity
 */
export const addUserModifying = <IEntity extends { modifiedById?: number }>(
  entity: IEntity,
  user: GetUserDto
): IEntity => {
  entity.modifiedById = user.id;
  return entity;
};

/**
 * Puts the identity of the transacting user into the `createdById` field of an entity to be saved. Mutates the entity argument and returns it.
 *
 * @param entity Entity (presumably a Post DTO) on which to add the user
 * @param user The transacting user
 * @returns Modified entity
 */
export const addUserCreating = <IEntity extends { createdById?: number }>(
  entity: IEntity,
  user: GetUserDto
) => {
  entity.createdById = user.id;
  return entity;
};
