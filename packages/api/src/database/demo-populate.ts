import { program } from 'commander';

program.option('-n, --noInteraction');
program.parse(process.argv);

const noInteraction = !!program.opts()?.noInteraction;

import {
  Edorg,
  EdorgType,
  GlobalRole,
  Ods,
  Ownership,
  Privilege,
  Resource,
  Role,
  Sbe,
  Tenant,
  User,
  UserTenantMembership
} from '@edanalytics/models';
import { districtName, generateFake, schoolType } from '@edanalytics/utils';
import { faker } from '@faker-js/faker';
import { execSync } from 'child_process';
import colors from 'colors/safe';
import prompts from 'prompts';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import typeormConfig from './typeorm.config';

const db = new DataSource({ ...typeormConfig, synchronize: false });
async function populate() {
  await db.initialize();
  await db.synchronize(true);
  db.transaction(async (dataSource) => {
    let givenName: string | undefined;
    let familyName: string | undefined;
    let userName: string | undefined;

    if (noInteraction) {
      console.log(colors.yellow('Using placeholder user info'));

      givenName = 'Testy';
      familyName = 'McTestFace';
      userName = 'testy@example.com';
    } else {
      try {
        try {
          [givenName, familyName] = execSync(
            'net user %USERNAME% | findstr "Full Name"',
            { encoding: 'utf8' }
          )
            .replace('Full Name', '')
            .trim()
            .split(' ');
        } catch (notWindows) {
          [givenName, familyName] = execSync(`git config --global user.name`, {
            encoding: 'utf8',
          })
            .trim()
            .split(' ');
        }
      } catch (err) {
        // fallback to blank default
      }
      try {
        userName = execSync('git config --global user.email', {
          encoding: 'utf8',
        })?.trim();
        if (userName?.includes('github')) {
          // don't want the ugly default github email so fall back to computer username
          userName = execSync('echo %USERNAME%', { encoding: 'utf8' })?.trim();
        }
      } catch (err) {
        // fallback to blank default
      }

      const out = await prompts([
        {
          type: 'text',
          name: 'givenName',
          message: 'What is your given name?',
          validate: (value) =>
            !value?.trim() ? `Please provide your given name.` : true,
          initial: givenName,
        },
        {
          type: 'text',
          name: 'familyName',
          message: 'What is your family name?',
          validate: (value) =>
            !value?.trim() ? `Please provide your family name.` : true,
          initial: familyName,
        },
        {
          type: 'text',
          name: 'userName',
          message: 'What is your username?',
          validate: (value) =>
            !value?.trim() ? `Please provide your username.` : true,
          initial: userName,
        },
      ]);

      givenName = out.givenName;
      familyName = out.familyName;
      userName = out.userName;
    }

    const userRepository = dataSource.getRepository(User);

    const me = await userRepository.save({
      username: userName,
      familyName: familyName,
      givenName: givenName,
      role: GlobalRole.Admin,
      isActive: true,
    });

    const otherUsers = await userRepository.save(
      generateFake(
        User,
        {
          createdBy: me,
        },
        13
      )
    );

    const users = [me, ...otherUsers];

    const tenants = await dataSource.getRepository(Tenant).save(
      generateFake(
        Tenant,
        () => ({
          createdBy: faker.helpers.arrayElement(users),
        }),
        25
      )
    );

    const sbes = await dataSource.getRepository(Resource).save(
      dataSource.getRepository(Resource).create(
        generateFake(
          Sbe,
          () => ({
            createdBy: faker.helpers.arrayElement(users),
          }),
          10
        ).map((sbe) => ({
          createdBy: sbe.createdBy,
          sbe,
        }))
      )
    );

    for (let is = 0; is < sbes.length; is++) {
      const sbe = sbes[is].sbe!;
      const seed = Math.random();
      const odss = await dataSource.getRepository(Resource).save(
        dataSource.getRepository(Resource).create(
          generateFake(
            Ods,
            () => ({
              createdBy: faker.helpers.arrayElement(users),
              sbe,
            }),
            seed > 0.9 ? 0 : seed > 0.7 ? 1 : faker.datatype.number(40)
          ).map((ods) => ({
            createdBy: ods.createdBy,
            ods,
          }))
        )
      );

      for (let io = 0; io < odss.length; io++) {
        const ods = odss[io].ods!;
        const seed = Math.random();
        const districts = await dataSource.getRepository(Resource).save(
          dataSource.getRepository(Resource).create(
            generateFake(
              Edorg,
              () => ({
                sbe,
                ods,
                createdBy: faker.helpers.arrayElement(users),
                discriminator: EdorgType['edfi.LocalEducationAgency'],
                nameOfInstitution: districtName(),
              }),
              seed > 0.9 ? 0 : seed > 0.2 ? 1 : faker.datatype.number(40)
            ).map((edorg) => ({
              createdBy: edorg.createdBy,
              edorg,
            }))
          )
        );

        for (let id = 0; id < districts.length; id++) {
          const district = districts[id].edorg!;
          const seed = Math.random();
          const schools = await dataSource.getRepository(Resource).save(
            dataSource.getRepository(Resource).create(
              generateFake(
                Edorg,
                () => ({
                  sbe,
                  ods,
                  parent: district,
                  createdBy: faker.helpers.arrayElement(users),
                  discriminator: EdorgType['edfi.School'],
                  nameOfInstitution: `${faker.address.street()} ${schoolType()}`,
                }),
                seed > 0.9 ? 0 : seed > 0.2 ? 1 : faker.datatype.number(18)
              ).map((edorg) => ({
                createdBy: edorg.createdBy,
                edorg,
              }))
            )
          );
        }
      }
    }

    // await dataSource.getRepository(UserTenantMembership).save(
    //   generateFake(
    //     UserTenantMembership,
    //     () => ({
    //       createdBy: faker.helpers.arrayElement(users),
    //     }),
    //     25
    //   )
    // );

    // await dataSource.getRepository(Privilege).save(
    //   generateFake(
    //     Privilege,
    //     undefined,
    //     25
    //   )
    // );

    // await dataSource.getRepository(Role).save(
    //   generateFake(
    //     Role,
    //     () => ({
    //       createdBy: faker.helpers.arrayElement(users),
    //     }),
    //     25
    //   )
    // );

    // await dataSource.getRepository(Ownership).save(
    //   generateFake(
    //     Ownership,
    //     () => ({
    //       createdBy: faker.helpers.arrayElement(users),
    //     }),
    //     25
    //   )
    // );

    console.log(colors.green('\nDone.'));
  });
}
populate();
