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
  | 'modifiedShort'
  | 'deletedShort'
  | 'createdDetailed'
  | 'modifiedDetailed'
  | 'deletedDetailed'
  | 'displayName';

export type DtoGetOmit = 'createdBy' | 'modifiedBy' | 'deletedBy';
export type GetDto<
  EntityInterface extends object,
  ExcludeProperties extends string = never
> = Omit<EntityInterface, DtoGetOmit | ExcludeProperties>;

/**
 * The user record's `createdById` field has to be nullable, which necessesitates a separate DTO base for User vs other entities. Everything else should use the other one which adds that field as required.
 */
export class DtoGetBase__User {
  // @ApiProperty()
  @Expose()
  createdById?: IUser['id'];

  // @ApiProperty()
  @Expose()
  id: number;

  // @ApiProperty()
  @Expose()
  @Type(() => Date)
  created: Date;

  // @ApiProperty()
  @Expose()
  @Type(() => Date)
  modified?: Date | undefined;

  // @ApiProperty()
  @Expose()
  @Type(() => Date)
  deleted?: Date | undefined;

  // @ApiProperty()
  @Expose()
  modifiedById?: IUser['id'];

  // @ApiProperty()
  @Expose()
  deletedById?: IUser['id'];

  get createdShort() {
    return this.created ? stdShort(this.created) : undefined;
  }
  get modifiedShort() {
    return this.modified ? stdShort(this.modified) : undefined;
  }
  get deletedShort() {
    return this.deleted ? stdShort(this.deleted) : undefined;
  }
  get createdDetailed() {
    return this.created ? stdDetailed(this.created) : undefined;
  }
  get modifiedDetailed() {
    return this.modified ? stdDetailed(this.modified) : undefined;
  }
  get deletedDetailed() {
    return this.deleted ? stdDetailed(this.deleted) : undefined;
  }
  get displayName() {
    return String(this.id);
  }
}

export abstract class DtoGetBase
  extends DtoGetBase__User
  implements Omit<IEntityBase, DtoGetOmit>
{
  // @ApiProperty()
  @Expose()
  override createdById: IUser['id'];
}
