import { Edorg, Ods, Privilege, Role } from '@edanalytics/models-server';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGlobalController } from './roles-global.controller';
import { RolesGlobalService } from './roles-global.service';

@Module({
  imports: [TypeOrmModule.forFeature([Edorg, Ods, Role, Role, Privilege])],
  controllers: [RolesGlobalController],
  providers: [RolesGlobalService],
})
export class RolesGlobalModule {}
