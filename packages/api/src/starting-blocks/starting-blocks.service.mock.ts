import {
  EdorgType,
  GetApplicationDto,
  GetClaimsetDto,
  GetVendorDto,
  PostApplicationDto,
  PostClaimsetDto,
  PostVendorDto,
  PutApplicationDto,
  PutClaimsetDto,
  PutVendorDto,
  SbMetaEdorg,
  SbMetaEnv,
  SbMetaOds,
} from '@edanalytics/models';
import { generateFake } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { plainToClass } from 'class-transformer';
import _ from 'lodash';
import { Repository } from 'typeorm';
import { IStartingBlocksService } from './starting-blocks.service.interface';
import { Sbe, Edorg, Ods } from '@edanalytics/models-server';

/**
 * This will return data vaguely relevant to the sbes, odss, and edorgs present in the database, but write operations are non-functional.
 */
@Injectable()
export class StartingBlocksServiceMock implements IStartingBlocksService {
  private data: Record<
    Sbe['id'],
    {
      sbe: Sbe;
      vendors: Record<number, GetVendorDto>;
      claimsets: Record<number, GetClaimsetDto>;
      applications: Record<number, GetApplicationDto>;
      edorgs: Record<number, Edorg>;
      odss: Record<number, Ods>;
      vendorApps: Record<number, number[]>;
    }
  > = {};
  constructor(
    @InjectRepository(Sbe)
    private sbesRepository: Repository<Sbe>,
    @InjectRepository(Ods)
    private odsRepository: Repository<Ods>,
    @InjectRepository(Edorg)
    private edorgRepository: Repository<Edorg>
  ) {
    const vendors = generateFake(GetVendorDto, undefined, 20) as GetVendorDto[];

    const claimsets = generateFake(
      GetClaimsetDto,
      undefined,
      6
    ) as GetClaimsetDto[];

    this.sbesRepository.find().then(async (sbes) => {
      for (let i = 0; i < sbes.length; i++) {
        const sbe = sbes[i];

        const edorgs = await this.edorgRepository.findBy({ sbeId: sbe.id });
        const odss = await this.odsRepository.findBy({ sbeId: sbe.id });

        this.data[sbe.id] = {
          sbe,
          vendors: vendors.reduce((a, v) => {
            a[v.vendorId] = { ...v };
            return a;
          }, {}),
          claimsets: claimsets.reduce((a, c) => {
            a[c.id] = { ...c };
            return a;
          }, {}),
          applications: [],
          edorgs: edorgs.reduce((a, e) => {
            a[e.educationOrganizationId] = e;
            return a;
          }, {}),
          odss: odss.reduce((a, o) => {
            a[o.id] = o;
            return a;
          }, {}),
          vendorApps: vendors.reduce((a, v) => {
            a[v.vendorId] = [];
            return a;
          }, {}),
        };
        if (edorgs.length > 0) {
          const applications = generateFake(
            GetApplicationDto,
            () => {
              const id = faker.datatype.number(999999);
              const edorg = _.sample(edorgs);
              const ods = this.data[sbe.id].odss[edorg.odsId];
              const claimset = _.sample(claimsets);
              const vendor = _.sample(vendors);
              this.data[sbe.id].vendorApps[vendor.vendorId].push(id);
              this.data[sbe.id].claimsets[claimset.id].applicationsCount++;
              return {
                applicationId: id,
                claimSetName: claimset.name,
                educationOrganizationId: edorg.educationOrganizationId,
                odsInstanceName: ods.dbName,
              };
            },
            Math.max(4, Math.round(edorgs.length / 3))
          ) as GetApplicationDto[];

          this.data[sbe.id].applications = applications.reduce((a, app) => {
            a[app.applicationId] = app;
            return a;
          }, {});
        }
      }
    });
  }

  async getVendors(tenantId: number, sbeId: Sbe['id']) {
    return Object.values(this.data[sbeId].vendors);
  }
  async getVendor(tenantId: number, sbeId: Sbe['id'], vendorId: number) {
    if (vendorId in this.data[sbeId]) {
      return this.data[sbeId].vendors[vendorId];
    } else {
      throw new NotFoundException();
    }
  }
  async putVendor(
    tenantId: number,
    sbeId: Sbe['id'],
    vendorId: number,
    vendor: PutVendorDto
  ) {
    if (vendorId in this.data[sbeId]) {
      return this.data[sbeId].vendors[vendorId];
    } else {
      throw new NotFoundException();
    }
  }
  async postVendor(tenantId: number, sbeId: Sbe['id'], vendor: PostVendorDto) {
    return Object.values(this.data[sbeId].vendors)[0];
  }
  async deleteVendor(tenantId: number, sbeId: Sbe['id'], vendorId: number) {
    // do nothing
  }
  async getVendorApplications(
    tenantId: number,
    sbeId: Sbe['id'],
    vendorId: number
  ) {
    const applicationIds = this.data[sbeId].vendorApps[vendorId];
    return Object.values(this.data[sbeId].applications).filter((app) =>
      applicationIds.includes(app.applicationId)
    );
  }

  async getApplications(tenantId: number, sbeId: Sbe['id']) {
    return Object.values(this.data[sbeId].applications);
  }
  async getApplication(
    tenantId: number,
    sbeId: Sbe['id'],
    applicationId: number
  ) {
    if (applicationId in this.data[sbeId].applications) {
      return this.data[sbeId].applications[applicationId];
    } else {
      throw new NotFoundException();
    }
  }
  async putApplication(
    tenantId: number,
    sbeId: Sbe['id'],
    applicationId: number,
    application: PutApplicationDto
  ) {
    if (applicationId in this.data[sbeId].applications) {
      return this.data[sbeId].applications[applicationId];
    } else {
      throw new NotFoundException();
    }
  }
  async postApplication(
    tenantId: number,
    sbeId: Sbe['id'],
    application: PostApplicationDto
  ) {
    return {
      applicationId: Number(Object.keys(this.data[sbeId].applications)[0]),
      key: faker.datatype.string(6),
      secret: faker.datatype.string(20),
    };
  }
  async deleteApplication(
    tenantId: number,
    sbeId: Sbe['id'],
    applicationId: number
  ) {
    // do nothing
  }
  async resetApplicationCredentials(
    tenantId: number,
    sbeId: Sbe['id'],
    applicationId: number
  ) {
    return {
      applicationId,
      key: faker.datatype.string(6),
      secret: faker.datatype.string(20),
    };
  }

  async getClaimsets(tenantId: number, sbeId: Sbe['id']) {
    return Object.values(this.data[sbeId].claimsets);
  }
  async getClaimset(tenantId: number, sbeId: Sbe['id'], claimsetId: number) {
    if (claimsetId in this.data[sbeId]) {
      return this.data[sbeId].claimsets[claimsetId];
    } else {
      throw new NotFoundException();
    }
  }
  async putClaimset(
    tenantId: number,
    sbeId: Sbe['id'],
    claimsetId: number,
    claimset: PutClaimsetDto
  ) {
    if (claimsetId in this.data[sbeId]) {
      return this.data[sbeId].claimsets[claimsetId];
    } else {
      throw new NotFoundException();
    }
  }
  async postClaimset(
    tenantId: number,
    sbeId: Sbe['id'],
    claimset: PostClaimsetDto
  ) {
    return Object.values(this.data[sbeId].claimsets)[0];
  }
  async deleteClaimset(tenantId: number, sbeId: Sbe['id'], claimsetId: number) {
    // do nothing
  }

  async getSbMeta(sbeId: Sbe['id']): Promise<SbMetaEnv> {
    return {
      envlabel: 'hotdogs-env',
      odss: [
        {
          dbname: 'hotdogs-db',
          edorgs: [
            {
              discriminator: EdorgType['edfi.LocalEducationAgency'],
              educationorganizationid: 123,
              nameofinstitution: 'Hotdogs District',
              edorgs: [
                {
                  discriminator: EdorgType['edfi.School'],
                  educationorganizationid: 1234,
                  nameofinstitution: 'Hotdogs School',
                },
              ],
            },
          ],
        },
      ],
    };
  }
}
