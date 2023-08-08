import { IEntityBase } from './entity-base.interface';

type DtoCreateOmit =
  | 'createdBy'
  | 'modifiedBy'
  | 'deletedBy'
  | 'id'
  | 'createdById'
  | 'modifiedById'
  | 'deletedById'
  | 'created'
  | 'modified'
  | 'deleted'
  | 'displayName';

/**
 * Type helper to create an interface typing for a Post DTO by omitting specific properties from the main entity interface.
 */
export type PostDto<
  EntityInterface extends object,
  ExcludeProperties extends string = never
> = Omit<EntityInterface, DtoCreateOmit | ExcludeProperties> & {
  createdById?: number | undefined;
};
export class DtoPostBase implements Partial<Omit<IEntityBase, DtoCreateOmit>> {
  /** This is to flesh out the typing so that the server can fill in
   * this field with the current user. `@Expose()` is intentionally
   * omitted because this field should not come from the client. */
  createdById?: number;
}
