import { IEntityBase } from './entity-base.interface';

type DtoWriteOmit =
  | 'createdBy'
  | 'modifiedBy'
  | 'deletedBy'
  | 'createdById'
  | 'deletedById'
  | 'created'
  | 'modified'
  | 'deleted'
  | 'displayName';
export type PutDto<EntityInterface extends object, ExcludeProperties extends string = never> = Omit<
  EntityInterface,
  DtoWriteOmit | ExcludeProperties
>;
export class DtoPutBase implements Omit<IEntityBase, DtoWriteOmit> {
  /** This is included for convenience so that mutations can take a
   * single argument instead of the body and id separately, even
   * though the id is only used in the URL and has no effect in the
   * server. */
  id: number;

  /** This is to flesh out the typing so that the server can fill in
   * this field with the current user. `@Expose()` is intentionally
   * omitted because this field should not come from the client. */
  modifiedById?: number | undefined;
}
