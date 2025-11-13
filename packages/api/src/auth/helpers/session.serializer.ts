import { Injectable, Logger } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import { AuthService } from '../auth.service';
import { User } from '@edanalytics/models-server';

@Injectable()
export class SessionSerializer extends PassportSerializer {

  constructor(private readonly authService: AuthService) {
    super();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serializeUser(user: User, done: (err: Error, user: any) => void): any {
    done(null, user.id);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async deserializeUser(userId: number, done: (err: Error, user?: any) => void): Promise<any> {
    try {
      // Validate user is still active and fetch fresh data
      const user = await this.authService.findActiveUserById(userId);
      
      if (!user || !user.isActive || !user.role) {
        Logger.warn(`User ${userId} no longer valid during deserialization - user deleted, inactive, or role removed`);
        return done(null, false); // This will log the user out
      }
      done(null, user);
    } catch (error) {
      Logger.error(`Error deserializing user ${userId}:`, error);
      done(null, false);
    }
  }
}
