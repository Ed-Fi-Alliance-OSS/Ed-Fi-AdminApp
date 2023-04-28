import {
  toGetPrivilegeDto
} from '@edanalytics/models';
import {
  Controller,
  Get,
  Param
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrivilegesService } from './privileges.service';

@ApiTags('Privilege')
@Controller()
export class PrivilegesController {
  constructor(private readonly privilegeService: PrivilegesService) { }

  @Get()
  async findAll() {
    return toGetPrivilegeDto(await this.privilegeService.findAll());
  }

  @Get(':privilegeId')
  async findOne(@Param('privilegeId') privilegeId: string) {
    return toGetPrivilegeDto(await this.privilegeService.findOne(privilegeId));
  }
}
