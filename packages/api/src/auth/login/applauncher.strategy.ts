import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { Request } from 'express'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { environment } from '../../environments/environment.local';
import { CognitoJwtVerifierSingleUserPool } from 'aws-jwt-verify/cognito-verifier';
import { CognitoAccessTokenPayload } from 'aws-jwt-verify/jwt-model';

@Injectable()
export class ApplauncherStrategy extends PassportStrategy(Strategy, 'custom') {
  verifier: CognitoJwtVerifierSingleUserPool<{
    userPoolId: string;
    tokenUse: "access";
    clientId: string;
  }>

  constructor(private authService: AuthService) {
    super();
    try {
      this.verifier = CognitoJwtVerifier.create({
        userPoolId: environment.COGNITO_POOL_ID,
        tokenUse: 'access',
        clientId: environment.COGNITO_CLIENT_ID,
      })
    } catch (cognitoConfigError) {
      console.warn('Error configuring cognito token validation.')
      throw cognitoConfigError
    }
  }

  async validate(req: Request) {
    try {
      let decodedAuthResult: { token: string, email: string };
      try {
        decodedAuthResult = JSON.parse(Buffer.from(req.params.authResult, "base64url").toString());
      } catch (unusableCallbackData) {
        console.warn('Unusable data in applauncher callback')
        throw unusableCallbackData
      }
      let payload: CognitoAccessTokenPayload;
      try {
        payload = await this.verifier.verify(decodedAuthResult.token)
      } catch (invalidToken) {
        console.warn('Invalid applauncher cognito token')
        throw invalidToken
      }

      const user = await this.authService.findOrCreateUser({
        username: payload.username
      })
      return user;
    } catch (err) {
      throw new UnauthorizedException();
    }
  }
}
