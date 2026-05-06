import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  it('should be defined', () => {
    const svc = new CatalogService(
      {} as any, // catalogVersionRepo
      {} as any, // dataSource
    );
    expect(svc).toBeDefined();
  });
});
