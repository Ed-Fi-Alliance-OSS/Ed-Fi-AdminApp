import { User } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>
  ) {}

  private async getUser(username: string) {
    const user = await this.usersRepo.findOneBy({ username });

    if (user === null) return null;

    return { user };
  }

  async findOrCreateUser(user: Partial<User> & Pick<User, 'username'>) {
    const foundUser = await this.getUser(user.username);
    if (foundUser) {
      return foundUser;
    } else {
      return {
        user: await this.usersRepo.save({
          ...user,
          isActive: false,
        }),
      };
    }
  }

  validateUser(username: string) {
    return this.getUser(username);
  }
}
