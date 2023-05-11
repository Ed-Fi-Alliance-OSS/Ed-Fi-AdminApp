import { Expose, Type } from "class-transformer";
import { EdorgType } from "../enums";
import { FakeMeUsing, deployEnv, districtName, schoolType, schoolYear } from "@edanalytics/utils";
import { faker } from "@faker-js/faker";

@FakeMeUsing(() => Math.random() > 0.2 ? ({
  discriminator: EdorgType['edfi.School'],
  nameOfInstitution: `${faker.address.street()} ${schoolType()}`,
}) : ({
  discriminator: EdorgType['edfi.LocalEducationAgency'],
  nameOfInstitution: districtName(),
}))
export class SbMetaEdorg {
  @Expose()
  educationorganizationid: number;

  @Expose()
  @FakeMeUsing(() => faker.datatype.number(999999999))
  nameofinstitution: string;

  @Expose()
  discriminator: EdorgType;

  @Expose()
  @Type(() => SbMetaEdorg)
  edorgs?: SbMetaEdorg[]
}

export class SbMetaOds {
  @FakeMeUsing(() => `EdFi_Ods_${faker.datatype.number(999999999)}`)
  @Expose()
  dbname: string;

  @Expose()
  @Type(() => SbMetaEdorg)
  edorgs?: SbMetaEdorg[]
}

export class SbMetaEnv {
  @FakeMeUsing(() => `${deployEnv()}-${schoolYear()}-${faker.random.alpha(5)}`)
  @Expose()
  envlabel: string;

  @Expose()
  @Type(() => SbMetaOds)
  odss?: SbMetaOds[]
}