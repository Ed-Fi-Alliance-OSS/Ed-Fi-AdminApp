import { User } from '@edanalytics/models-server';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionSerializer } from './helpers/session.serializer';
import { OidcStrategy, buildOpenIdClient } from './login/oidc.strategy';
import { LocalStrategy } from './login/local.strategy';
import { ApplauncherStrategy } from './login/applauncher.strategy';

const OidcStrategyFactory = {
  provide: 'OidcStrategy',
  useFactory: async (authService: AuthService) => {
    const client = await buildOpenIdClient();
    const strategy = new OidcStrategy(authService, client);
    return strategy;
  },
  inject: [AuthService],
};

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ session: true }),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [AuthController],
  providers: [
    OidcStrategyFactory,
    AuthService,
    LocalStrategy,
    ApplauncherStrategy,
    SessionSerializer,
  ],
})
export class AuthModule {}
