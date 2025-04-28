import { IIntegrationProvider } from '@edanalytics/models';
import { Column, Entity, Index } from 'typeorm';
import { EntityBase } from '../utils/entity-base';

@Index(['name'], { unique: true })
@Entity()
export class IntegrationProvider extends EntityBase implements IIntegrationProvider {
  @Column()
  name: string;

  @Column()
  description: string;
}
