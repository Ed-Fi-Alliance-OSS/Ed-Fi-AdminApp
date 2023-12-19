import { Checkbox, Text } from '@chakra-ui/react';
import { EdorgType, EdorgTypeShort, RoleType } from '@edanalytics/models';
import { enumValues } from '@edanalytics/utils';
import uniq from 'lodash/uniq';
import { useMemo, useState } from 'react';
import {
  applicationQueries,
  claimsetQueries,
  edorgQueries,
  odsQueries,
  roleQueries,
  sbeQueries,
  tenantQueries,
  userQueries,
  vendorQueries,
} from '../api';
import { SelectWrapper, StandardSelector } from './StandardSelector';
import { useNavContext, useTenantSbeNavContext } from './navContext';

export const SelectRole: StandardSelector<{ types: RoleType[] }> = (props) => {
  const { types, ...others } = props;
  const { tenantId } = useNavContext();
  const roles = roleQueries.useAll({ tenantId });
  const options = Object.fromEntries(
    Object.values(roles.data ?? {})
      .filter((role) => types.includes(role.type))
      .map((role) => [
        role.id,
        {
          value: role.id,
          label: role.displayName,
        },
      ])
  );
  return <SelectWrapper {...others} isLoading={roles.isLoading} options={options} />;
};

export const SelectClaimset: StandardSelector<{
  useName?: boolean | undefined;
  noReserved?: boolean | undefined;
}> = (props) => {
  const { useName, noReserved, ...others } = props;
  const { tenantId, sbeId } = useTenantSbeNavContext();
  const claimsets = claimsetQueries.useAll({ tenantId, sbeId });
  const claimsetsArr = props.noReserved
    ? Object.values(claimsets.data ?? {}).filter((claimset) => !claimset.isSystemReserved)
    : Object.values(claimsets.data ?? {});
  const options = Object.fromEntries(
    claimsetsArr.map((claimset) => [
      props.useName ? claimset.name : claimset.id,
      {
        value: props.useName ? claimset.name : claimset.id,
        label: claimset.displayName,
      },
    ])
  );
  return <SelectWrapper {...others} options={options} isLoading={claimsets.isFetching} />;
};

export const SelectSbe: StandardSelector = (props) => {
  const { ...others } = props;
  const { tenantId } = useNavContext();
  const sbes = sbeQueries.useAll({ tenantId });
  const options = Object.fromEntries(
    Object.values(sbes.data ?? {}).map((sbe) => [
      sbe.id,
      {
        value: sbe.id,
        label: sbe.displayName,
      },
    ])
  );
  return <SelectWrapper {...others} options={options} isLoading={sbes.isFetching} />;
};
export const SelectTenant: StandardSelector = (props) => {
  const { ...others } = props;
  const tenants = tenantQueries.useAll({});
  const options = Object.fromEntries(
    Object.values(tenants.data ?? {}).map((tenant) => [
      tenant.id,
      {
        value: tenant.id,
        label: tenant.displayName,
      },
    ])
  );
  return <SelectWrapper {...others} options={options} isLoading={tenants.isFetching} />;
};
export const SelectUser: StandardSelector = (props) => {
  const { ...others } = props;
  const { tenantId } = useNavContext();
  const users = userQueries.useAll({ tenantId });
  const options = Object.fromEntries(
    Object.values(users.data ?? {}).map((user) => [
      user.id,
      {
        value: user.id,
        label: user.displayName,
      },
    ])
  );
  return <SelectWrapper {...others} options={options} isLoading={users.isFetching} />;
};

export const SelectVendor: StandardSelector = (props) => {
  const { ...others } = props;
  const { tenantId, sbeId } = useTenantSbeNavContext();
  const vendors = vendorQueries.useAll({ tenantId, sbeId });
  const options = Object.fromEntries(
    Object.values(vendors.data ?? {}).map((vendor) => [
      vendor.id,
      {
        value: vendor.id,
        label: vendor.displayName,
      },
    ])
  );
  return <SelectWrapper {...others} options={options} isLoading={vendors.isFetching} />;
};

export const SelectApplication: StandardSelector = (props) => {
  const { ...others } = props;
  const { tenantId, sbeId } = useTenantSbeNavContext();
  const applications = applicationQueries.useAll({ tenantId, sbeId });
  const options = Object.fromEntries(
    Object.values(applications.data ?? {}).map((application) => [
      application.id,
      {
        value: application.id,
        label: application.displayName,
      },
    ])
  );
  return <SelectWrapper {...others} options={options} isLoading={applications.isFetching} />;
};

export const SelectOds: StandardSelector<{ useDbName?: boolean }> = (props) => {
  const { useDbName, ...others } = props;
  const { tenantId, sbeId } = useTenantSbeNavContext();
  const odss = odsQueries.useAll({ tenantId, sbeId });
  const options = Object.fromEntries(
    Object.values(odss.data ?? {}).map((ods) => [
      useDbName ? ods.dbName : ods.id,
      {
        value: useDbName ? ods.dbName : ods.id,
        label: ods.displayName,
      },
    ])
  );
  return <SelectWrapper {...others} options={options} isLoading={odss.isFetching} />;
};

export const SelectEdorg: StandardSelector<{ useEdorgId?: boolean }> = (props) => {
  const { useEdorgId, ...others } = props;
  const { tenantId, sbeId } = useTenantSbeNavContext();
  const edorgs = edorgQueries.useAll({ tenantId, sbeId });
  const discriminators = useMemo(
    () => uniq(Object.values(edorgs.data ?? {}).map((edorg) => edorg.discriminator)),
    [edorgs]
  );
  const [include, setInclude] = useState<string[]>(enumValues(EdorgType));
  const options = useMemo(
    () =>
      Object.fromEntries(
        Object.values(edorgs.data ?? {})
          .map((edorg) =>
            include.includes(edorg.discriminator)
              ? [
                  [
                    useEdorgId ? edorg.educationOrganizationId : edorg.id,
                    {
                      value: useEdorgId ? edorg.educationOrganizationId : edorg.id,
                      label: edorg.displayName,
                      subLabel: `${edorg.educationOrganizationId} ${edorg.discriminatorShort}`,
                    },
                  ],
                ]
              : []
          )
          .flat(1)
      ),
    [edorgs]
  );
  const filterApplied = useMemo(
    () => !discriminators.every((d) => include.includes(d)),
    [discriminators, include]
  );
  return (
    <SelectWrapper
      {...others}
      options={options}
      isLoading={edorgs.isFetching}
      filterApplied={filterApplied}
      onFilterDoubleClick={() => setInclude(enumValues(EdorgType))}
      filterPane={
        discriminators.length ? (
          discriminators.map((d) => (
            <Checkbox
              key={d}
              isChecked={include.includes(d)}
              onChange={() =>
                setInclude((old): string[] =>
                  old.includes(d) ? old.filter((di) => di !== d) : [...old, d]
                )
              }
            >
              {EdorgTypeShort[d]}
            </Checkbox>
          ))
        ) : (
          <Text as="i" color="gray.400">
            (No Ed-Org types available)
          </Text>
        )
      }
    />
  );
};
