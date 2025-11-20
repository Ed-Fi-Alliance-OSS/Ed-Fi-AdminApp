import { Expose } from 'class-transformer';

export class Id {
  constructor(id: number) {
    this.id = id;
  }
  @Expose()
  id: number;
}
