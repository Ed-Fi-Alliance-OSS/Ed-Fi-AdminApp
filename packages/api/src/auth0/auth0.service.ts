import { Injectable } from '@nestjs/common';
import { ManagementClient } from 'auth0';
import config from 'config';

@Injectable()
export class Auth0Service {
  constructor() {}

  private client: ManagementClient;

  private async getManagementApiClient() {
    if (this.client) {
      return this.client;
    }

    const AUTH0_CONFIG_SECRET = await config.AUTH0_CONFIG_SECRET;
    if (!AUTH0_CONFIG_SECRET.MANAGEMENT_DOMAIN) {
      throw new Error('AUTH0_CONFIG_SECRET.MANAGEMENT_DOMAIN is not defined');
    }
    if (!AUTH0_CONFIG_SECRET.MANAGEMENT_CLIENT_ID) {
      throw new Error('AUTH0_CONFIG_SECRET.MANAGEMENT_CLIENT_ID is not defined');
    }
    if (!AUTH0_CONFIG_SECRET.MANAGEMENT_CLIENT_SECRET) {
      throw new Error('AUTH0_CONFIG_SECRET.MANAGEMENT_CLIENT_SECRET is not defined');
    }

    this.client = new ManagementClient({
      domain: AUTH0_CONFIG_SECRET.MANAGEMENT_DOMAIN.replace('https://', ''),
      clientId: AUTH0_CONFIG_SECRET.MANAGEMENT_CLIENT_ID,
      clientSecret: AUTH0_CONFIG_SECRET.MANAGEMENT_CLIENT_SECRET,
    });
    return this.client;
  }

  async createApplication({ name, description }: { name: string; description: string }) {
    const apiClient = await this.getManagementApiClient();
    const AUTH0_CONFIG_SECRET = await config.AUTH0_CONFIG_SECRET;
    if (!AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE) {
      throw new Error('AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE is not defined');
    }

    const { CODE_ENV } = config;
    const nameSuffix = CODE_ENV ? ` (SBAA ${CODE_ENV})` : '';

    const instanceMetadata = CODE_ENV ? { instance: CODE_ENV } : undefined;
    const clientMetadata = { app: 'sbaa', ...instanceMetadata };

    const clientResponse = await apiClient.clients.create({
      app_type: 'non_interactive',
      name: name + nameSuffix,
      description,
      token_endpoint_auth_method: 'client_secret_post',
      grant_types: ['client_credentials'],
      client_metadata: clientMetadata,
    });
    await apiClient.clientGrants.create({
      client_id: clientResponse.data.client_id,
      audience: AUTH0_CONFIG_SECRET.MACHINE_AUDIENCE,
      scope: ['login:app'],
    });
    return clientResponse.data;
  }

  async resetCredentials(clientId: string) {
    const apiClient = await this.getManagementApiClient();
    return await apiClient.clients.rotateClientSecret({ client_id: clientId });
  }

  async deleteApplication(clientId: string) {
    const apiClient = await this.getManagementApiClient();
    return await apiClient.clients.delete({ client_id: clientId });
  }
}
