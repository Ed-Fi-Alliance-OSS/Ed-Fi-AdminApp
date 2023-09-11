import { RoleType } from '@edanalytics/models';
import {
  Ownership,
  Role,
  Sbe,
  Tenant,
  User,
  UserTenantMembership,
  generateFake,
} from '@edanalytics/models-server';
import { faker } from '@faker-js/faker';
import { Logger } from '@nestjs/common';
import colors from 'colors/safe';
import * as _ from 'lodash';
import 'reflect-metadata';
import { EntityManager } from 'typeorm';

export const seedDemoData = async (db: EntityManager) => {
  console.log('');
  Logger.log(colors.cyan(`Seeding general demo data.`));

  const userRepository = db.getRepository(User);

  const baseRole = await db.getRepository(Role).findOneByOrFail({
    name: 'Standard tenant user',
  });

  const adminRole = await db.getRepository(Role).findOneByOrFail({
    name: 'Global admin',
  });

  const globalViewer = await db.getRepository(Role).findOneByOrFail({
    name: 'Global viewer',
  });

  const users = await userRepository.save(
    generateFake(
      User,
      {
        role: _.sample([...Array(10).fill(baseRole), adminRole, globalViewer]),
      },
      30
    )
  );

  const tenants = await db.getRepository(Tenant).save(
    generateFake(
      Tenant,
      () => ({
        createdBy: faker.helpers.arrayElement(users),
      }),
      8
    )
  );

  const sbes = await db.getRepository(Sbe).save(
    generateFake(
      Sbe,
      () => ({
        createdBy: faker.helpers.arrayElement(users),
      }),
      5
    )
  );

  const tenantUserRoles = await db.getRepository(Role).findBy({
    type: RoleType.UserTenant,
  });

  const ownershipRoles = await db.getRepository(Role).findBy({
    type: RoleType.ResourceOwnership,
  });

  await db.getRepository(Ownership).save(
    sbes.flatMap((sbe) => {
      const tenantsNoReplacement = faker.helpers.shuffle([...tenants]);
      return generateFake(
        Ownership,
        () => ({
          tenant: tenantsNoReplacement.shift(),
          role: _.sample(ownershipRoles),
          sbeId: sbe.id,
        }),
        faker.datatype.number(3)
      );
    })
  );

  await db.getRepository(UserTenantMembership).save(
    users.flatMap((user) => {
      const tenantsNoReplacement = faker.helpers.shuffle([...tenants]);
      return generateFake(
        UserTenantMembership,
        () => ({
          createdBy: faker.helpers.arrayElement(users),
          tenant: tenantsNoReplacement.shift(),
          role: _.sample([undefined, ...tenantUserRoles, ...tenantUserRoles]),
          user,
        }),
        faker.datatype.number(2)
      );
    })
  );

  [`- Users`, `- Tenants`, `- Tenant memberships`, `- Sbes`, `- Sbe ownerships`].forEach((str) =>
    Logger.log(colors.cyan(str))
  );

  Logger.log(colors.cyan('Done.'));
};
