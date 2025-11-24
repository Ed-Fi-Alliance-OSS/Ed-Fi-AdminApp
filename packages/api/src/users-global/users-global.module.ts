import { Module } from '@nestjs/common';
import { UsersGlobalController } from './users-global.controller';

@Module({
  controllers: [UsersGlobalController],
})
export class UsersGlobalModule {}
