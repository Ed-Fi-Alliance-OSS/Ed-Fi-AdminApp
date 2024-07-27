import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';

@Injectable()
export class SessionSerializer extends PassportSerializer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serializeUser(user: any, done: (err: Error, user: any) => void): any {
    done(null, user);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deserializeUser(payload: any, done: (err: Error, payload: string) => void): any {
    done(null, payload);
  }
}
