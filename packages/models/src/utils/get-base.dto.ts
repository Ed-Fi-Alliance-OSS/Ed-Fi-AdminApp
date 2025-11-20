import { stdDetailed, stdShort } from '@edanalytics/utils';
import { Expose, Type } from 'class-transformer';
import { IUser } from '../interfaces/user.interface';
import { IEntityBase } from './entity-base.interface';
// import { ApiProperty } from '@nestjs/swagger'

/**
 * The naive way to type the class-transformer deserializer would be to expect the base object to include all relevant properties.
 * However, the getters should be omitted because they're supplied by the class prototype rather than the serialized values. So
 * this is just a typing utility to exclude getters from a GetDto typing annotation.
 */
export type GettersOmit =
  | 'createdShort'
  | 'createdNumber'
  | 'modifiedShort'
  | 'modifiedNumber'
  | 'createdDetailed'
  | 'modifiedDetailed'
  | 'displayName';

export type DtoGetOmit = 'createdBy' | 'modifiedBy';
export type GetDto<EntityInterface extends object, ExcludeProperties extends string = never> = Omit<
  EntityInterface,
  DtoGetOmit | ExcludeProperties
>;

/**
 * The user record's `createdById` field has to be nullable, which necessesitates a separate DTO base for User vs other entities. Everything else should use the other one which adds that field as required.
 */
export class DtoGetBase__User {
  @Expose()
  createdById?: IUser['id'];

  @Expose()
  id: number;

  @Expose()
  @Type(() => Date)
  created: Date;

  @Expose()
  @Type(() => Date)
  modified?: Date | undefined;

  @Expose()
  modifiedById?: IUser['id'];

  get createdNumber() {
    return this.created ? this.created.getTime() : undefined;
  }

  get modifiedNumber() {
    return this.modified ? this.modified.getTime() : undefined;
  }

  get createdShort() {
    return this.created ? stdShort(this.created) : undefined;
  }
  get modifiedShort() {
    return this.modified ? stdShort(this.modified) : undefined;
  }
  get createdDetailed() {
    return this.created ? stdDetailed(this.created) : undefined;
  }
  get modifiedDetailed() {
    return this.modified ? stdDetailed(this.modified) : undefined;
  }
  get displayName() {
    return String(this.id);
  }
}

export abstract class DtoGetBase
  extends DtoGetBase__User
  implements Omit<IEntityBase, DtoGetOmit> {}
