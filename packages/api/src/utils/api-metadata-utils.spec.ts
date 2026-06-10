import { validateTenantModeCompatibility, determineTenantModeFromMetadata, determineTenantModeFromOdsMetadata, getAdminApiTenantMode } from './api-metadata-utils';
import { ValidationHttpException } from './customExceptions';
import { OdsApiMeta } from '@edanalytics/models';

describe('api-metadata-utils', () => {
  describe('validateTenantModeCompatibility', () => {
    it('should pass when both APIs are MultiTenant', () => {
      expect(() => {
        validateTenantModeCompatibility('MultiTenant', 'MultiTenant');
      }).not.toThrow();
    });

    it('should pass when both APIs are SingleTenant', () => {
      expect(() => {
        validateTenantModeCompatibility('SingleTenant', 'SingleTenant');
      }).not.toThrow();
    });

    it('should throw error when ODS is MultiTenant but Admin API is SingleTenant', () => {
      expect(() => {
        validateTenantModeCompatibility('MultiTenant', 'SingleTenant');
      }).toThrow(ValidationHttpException);
    });

    it('should throw error when ODS is SingleTenant but Admin API is MultiTenant', () => {
      expect(() => {
        validateTenantModeCompatibility('SingleTenant', 'MultiTenant');
      }).toThrow(ValidationHttpException);
    });

    it('should have proper error message format', () => {
      let errorThrown = false;
      try {
        validateTenantModeCompatibility('MultiTenant', 'SingleTenant');
      } catch (error: any) {
        errorThrown = true;
        expect(error).toBeInstanceOf(ValidationHttpException);
        // Verify the error message contains the expected tenant mode information
        const errorString = JSON.stringify(error.getResponse?.() || error.message || '');
        expect(errorString).toContain('Ed-Fi API and Management API URLs');
        expect(errorString).toContain('SingleTenant');
        expect(errorString).toContain('MultiTenant');
      }
      expect(errorThrown).toBe(true);
    });
  });

  describe('determineTenantModeFromMetadata', () => {
    const mockOdsApiMetaMultiTenant: OdsApiMeta = {
      version: '7.0',
      informationalVersion: '7.0.0',
      suite: 'ODS/API',
      build: '12345',
      apiMode: 'default',
      dataModels: [
        {
          name: 'Ed-Fi',
          version: '3.3.1-b',
          informationalVersion: '3.3.1-b',
        },
      ],
      urls: {
        dependencies: 'https://api.example.com/data/v3.0b/dependencies',
        openApiMetadata: 'https://api.example.com/data/v3.0b/swagger.json',
        oauth: 'https://api.example.com/oauth/authorize',
        dataManagementApi: 'https://api.example.com/data/v3.0b/tenantIdentifier/{id}',
        xsdMetadata: 'https://api.example.com/metadata',
        changeQueries: 'https://api.example.com/data/v3.0b/changeQueries',
        composites: 'https://api.example.com/data/v3.0b/composites',
      },
    };

    const mockOdsApiMetaSingleTenant: OdsApiMeta = {
      version: '7.0',
      informationalVersion: '7.0.0',
      suite: 'ODS/API',
      build: '12345',
      apiMode: 'default',
      dataModels: [
        {
          name: 'Ed-Fi',
          version: '3.3.1-b',
          informationalVersion: '3.3.1-b',
        },
      ],
      urls: {
        dependencies: 'https://api.example.com/data/v3.0b/dependencies',
        openApiMetadata: 'https://api.example.com/data/v3.0b/swagger.json',
        oauth: 'https://api.example.com/oauth/authorize',
        dataManagementApi: 'https://api.example.com/data/v3.0b/',
        xsdMetadata: 'https://api.example.com/metadata',
        changeQueries: 'https://api.example.com/data/v3.0b/changeQueries',
        composites: 'https://api.example.com/data/v3.0b/composites',
      },
    };

    it('should prioritize Admin API multitenantMode field when available (MultiTenant)', () => {
      const adminApiInfo = { tenancy: { multitenantMode: true } };
      const result = determineTenantModeFromMetadata(mockOdsApiMetaSingleTenant, adminApiInfo);
      expect(result).toBe('MultiTenant');
    });

    it('should prioritize Admin API multitenantMode field when available (SingleTenant)', () => {
      const adminApiInfo = { tenancy: { multitenantMode: false } };
      const result = determineTenantModeFromMetadata(mockOdsApiMetaMultiTenant, adminApiInfo);
      expect(result).toBe('SingleTenant');
    });

    it('should fall back to ODS API URL pattern when Admin API info not provided (MultiTenant)', () => {
      const result = determineTenantModeFromMetadata(mockOdsApiMetaMultiTenant);
      expect(result).toBe('MultiTenant');
    });

    it('should fall back to ODS API URL pattern when Admin API info not provided (SingleTenant)', () => {
      const result = determineTenantModeFromMetadata(mockOdsApiMetaSingleTenant);
      expect(result).toBe('SingleTenant');
    });

    it('should fall back to ODS API URL pattern when Admin API info has no tenancy field', () => {
      const adminApiInfo = {};
      const result = determineTenantModeFromMetadata(mockOdsApiMetaMultiTenant, adminApiInfo);
      expect(result).toBe('MultiTenant');
    });

    it('should fall back to ODS API URL pattern when Admin API info has no multitenantMode field', () => {
      const adminApiInfo = { tenancy: {} };
      const result = determineTenantModeFromMetadata(mockOdsApiMetaSingleTenant, adminApiInfo);
      expect(result).toBe('SingleTenant');
    });
  });

  describe('determineTenantModeFromOdsMetadata', () => {
    const mockOdsApiMetaMultiTenant: OdsApiMeta = {
      version: '7.0',
      informationalVersion: '7.0.0',
      suite: 'ODS/API',
      build: '12345',
      apiMode: 'default',
      dataModels: [
        {
          name: 'Ed-Fi',
          version: '3.3.1-b',
          informationalVersion: '3.3.1-b',
        },
      ],
      urls: {
        dependencies: 'https://api.example.com/data/v3.0b/dependencies',
        openApiMetadata: 'https://api.example.com/data/v3.0b/swagger.json',
        oauth: 'https://api.example.com/oauth/authorize',
        dataManagementApi: 'https://api.example.com/data/v3.0b/tenantIdentifier/{id}',
        xsdMetadata: 'https://api.example.com/metadata',
        changeQueries: 'https://api.example.com/data/v3.0b/changeQueries',
        composites: 'https://api.example.com/data/v3.0b/composites',
      },
    };

    const mockOdsApiMetaSingleTenant: OdsApiMeta = {
      version: '7.0',
      informationalVersion: '7.0.0',
      suite: 'ODS/API',
      build: '12345',
      apiMode: 'default',
      dataModels: [
        {
          name: 'Ed-Fi',
          version: '3.3.1-b',
          informationalVersion: '3.3.1-b',
        },
      ],
      urls: {
        dependencies: 'https://api.example.com/data/v3.0b/dependencies',
        openApiMetadata: 'https://api.example.com/data/v3.0b/swagger.json',
        oauth: 'https://api.example.com/oauth/authorize',
        dataManagementApi: 'https://api.example.com/data/v3.0b/',
        xsdMetadata: 'https://api.example.com/metadata',
        changeQueries: 'https://api.example.com/data/v3.0b/changeQueries',
        composites: 'https://api.example.com/data/v3.0b/composites',
      },
    };

    it('should determine MultiTenant mode from ODS metadata URL pattern', () => {
      const result = determineTenantModeFromOdsMetadata(mockOdsApiMetaMultiTenant);
      expect(result).toBe('MultiTenant');
    });

    it('should determine SingleTenant mode from ODS metadata URL pattern', () => {
      const result = determineTenantModeFromOdsMetadata(mockOdsApiMetaSingleTenant);
      expect(result).toBe('SingleTenant');
    });
  });

  describe('getAdminApiTenantMode', () => {
    it('should return MultiTenant when multitenantMode is true', () => {
      const adminApiInfo = { tenancy: { multitenantMode: true } };
      const result = getAdminApiTenantMode(adminApiInfo);
      expect(result).toBe('MultiTenant');
    });

    it('should return SingleTenant when multitenantMode is false', () => {
      const adminApiInfo = { tenancy: { multitenantMode: false } };
      const result = getAdminApiTenantMode(adminApiInfo);
      expect(result).toBe('SingleTenant');
    });

    it('should return undefined when multitenantMode is not provided', () => {
      const adminApiInfo = { tenancy: {} };
      const result = getAdminApiTenantMode(adminApiInfo);
      expect(result).toBeUndefined();
    });

    it('should return undefined when tenancy is not provided', () => {
      const adminApiInfo = {};
      const result = getAdminApiTenantMode(adminApiInfo);
      expect(result).toBeUndefined();
    });

    it('should return undefined when adminApiInfo is undefined', () => {
      const result = getAdminApiTenantMode(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined when adminApiInfo is null', () => {
      const result = getAdminApiTenantMode(null as any);
      expect(result).toBeUndefined();
    });
  });
});
