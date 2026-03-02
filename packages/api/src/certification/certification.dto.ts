import { IsString, IsOptional, IsObject } from 'class-validator';

export class ScenarioRunnerDto {
  @IsString()
  scriptPath!: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, string | number>;

  @IsOptional()
  @IsObject()
  auth?: { type?: 'bearer'; token?: string };
}
