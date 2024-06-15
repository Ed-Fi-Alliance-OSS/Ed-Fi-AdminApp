import { Expose } from 'class-transformer';
import { TrimWhitespace } from '../utils';

// TODO: This DTO is unused and should eventually be removed
export class PostLoginDto {
  @Expose()
  @TrimWhitespace()
  username: string;
  @Expose()
  password: string;
}
