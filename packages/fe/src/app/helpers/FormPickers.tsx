import {
  Box,
  Checkbox,
  FormControl,
  HStack,
  Icon,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
  Text,
} from '@chakra-ui/react';
import { VirtualizedSelect } from '@edanalytics/common-ui';
import { EdorgType, EdorgTypeShort, RoleType } from '@edanalytics/models';
import { enumValues } from '@edanalytics/utils';
import sortBy from 'lodash/sortBy';
import uniq from 'lodash/uniq';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Control,
  Controller,
  ControllerFieldState,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
  UseFormStateReturn,
} from 'react-hook-form';
import { BsFunnel, BsFunnelFill } from 'react-icons/bs';
import {
  TenantOptions,
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

const InnerSelect = (
  props: {
    field: ControllerRenderProps<any, any>;
    fieldState: ControllerFieldState;
    formState: UseFormStateReturn<any>;
  } & {
    control: Control<any>;
    name: any;
    options: Record<string, { value: number | string; label: string; subLabel?: string }>;
    onClick?: (value: any) => void;
    isLoading?: boolean;
  }
) => {
  const optionsArray = useMemo(
    () => sortBy(Object.values(props.options), 'label'),
    [props.options]
  );

  useEffect(() => {
    if (
      !props.isLoading &&
      props.field.value !== undefined &&
      !(String(props.field.value) in props.options)
    ) {
      props.field.onChange(undefined);
    }
  }, [props.options, props.field.value, props.field.onChange]);

  return (
    <VirtualizedSelect
      options={optionsArray as any}
      name={props.field.name}
      onBlur={props.field.onBlur}
      selectedOptionStyle="check"
      value={
        props.field.value === undefined
          ? { label: 'Select an option', value: '' as any }
          : {
              label: props.isLoading
                ? '...loading'
                : props.options?.[props.field.value as any]?.label ?? '',
              subLabel: props.isLoading
                ? undefined
                : props.options?.[props.field.value as any]?.subLabel,
              value: props.field.value,
            }
      }
      onChange={(value: any) => {
        props.field.onChange(value?.value);
      }}
    />
  );
};

function SelectWrapper<Dto extends Record<Name, number>, Name extends keyof Dto>(props: {
  control: Control<Dto>;
  name: Name;
  options: Record<string, { value: number | string; label: string; subLabel?: string }>;
  onClick?: (value: any) => void;
  isLoading?: boolean;
  filterApplied?: boolean;
  filterPane?: ReactNode;
  onFilterDoubleClick?: () => void;
}) {
  return (
    <HStack>
      <Box flexGrow={1}>
        <Controller
          control={props.control}
          name={props.name as any}
          render={(args) => <InnerSelect {...args} {...props} />}
        />
      </Box>
      {props.filterPane === undefined || props.filterPane === null ? null : (
        <Popover>
          <PopoverTrigger>
            <IconButton
              variant="ghost"
              aria-label="edit filters"
              icon={<Icon as={props.filterApplied ? BsFunnelFill : BsFunnel} />}
              onDoubleClick={props.onFilterDoubleClick}
            />
          </PopoverTrigger>
          <PopoverContent w="xs">
            <PopoverArrow />

            <PopoverHeader justifyContent="space-between" display="flex" fontWeight="bold">
              Filters <PopoverCloseButton position="unset" />
            </PopoverHeader>
            <PopoverBody>
              <FormControl display="flex" py="1em" gap="0.35em" flexDir="column">
                {props.filterPane}
              </FormControl>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      )}
    </HStack>
  );
}

type FormPickerTypeProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
  IncludeSbe extends boolean,
  IncludeTenant extends TenantOptions,
  OtherProps extends object = object
> = {
  control: Control<TFieldValues>;
  name: TName;
  onClick?: (value: any) => void;
  isLoading?: boolean;
} & OtherProps &
  (IncludeTenant extends TenantOptions.Never
    ? object
    : IncludeTenant extends TenantOptions.Optional
    ? {
        tenantId: string | number | undefined;
      }
    : { tenantId: string | number }) &
  (IncludeSbe extends false ? object : { sbeId: string | number });

export const SelectRole = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: FormPickerTypeProps<
    TFieldValues,
    TName,
    false,
    TenantOptions.Optional,
    { types: RoleType[] }
  >
) => {
  const { tenantId, types, ...others } = props;
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
  return <SelectWrapper {...others} options={options} />;
};

export const SelectSbe = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: FormPickerTypeProps<TFieldValues, TName, false, TenantOptions.Optional>
) => {
  const { tenantId, control, name } = props;
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
  return (
    <SelectWrapper control={control} name={name} options={options} isLoading={sbes.isFetching} />
  );
};
export const SelectTenant = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: FormPickerTypeProps<TFieldValues, TName, false, TenantOptions.Never>
) => {
  const { control, name } = props;
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
  return (
    <SelectWrapper control={control} name={name} options={options} isLoading={tenants.isFetching} />
  );
};
export const SelectUser = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: FormPickerTypeProps<TFieldValues, TName, false, TenantOptions.Optional>
) => {
  const { control, name, tenantId } = props;
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
  return (
    <SelectWrapper control={control} name={name} options={options} isLoading={users.isFetching} />
  );
};

export const SelectClaimset = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: FormPickerTypeProps<
    TFieldValues,
    TName,
    true,
    TenantOptions.Required,
    { useName?: boolean | undefined }
  >
) => {
  const { control, name, tenantId, sbeId } = props;
  const claimsets = claimsetQueries.useAll({ tenantId, sbeId });
  const options = Object.fromEntries(
    Object.values(claimsets.data ?? {}).map((claimset) => [
      props.useName ? claimset.name : claimset.id,
      {
        value: props.useName ? claimset.name : claimset.id,
        label: claimset.displayName,
      },
    ])
  );
  return (
    <SelectWrapper
      control={control}
      name={name}
      options={options}
      isLoading={claimsets.isFetching}
    />
  );
};

export const SelectVendor = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: FormPickerTypeProps<TFieldValues, TName, true, TenantOptions.Required>
) => {
  const { control, name, tenantId, sbeId } = props;
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
  return (
    <SelectWrapper control={control} name={name} options={options} isLoading={vendors.isFetching} />
  );
};

export const SelectApplication = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: FormPickerTypeProps<TFieldValues, TName, true, TenantOptions.Required>
) => {
  const { control, name, tenantId, sbeId } = props;
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
  return (
    <SelectWrapper
      control={control}
      name={name}
      options={options}
      isLoading={applications.isFetching}
    />
  );
};

export const SelectOds = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: FormPickerTypeProps<
    TFieldValues,
    TName,
    true,
    TenantOptions.Optional,
    { useDbName?: boolean | undefined }
  >
) => {
  const { control, name, tenantId, sbeId } = props;
  const odss = odsQueries.useAll({ tenantId, sbeId });
  const options = Object.fromEntries(
    Object.values(odss.data ?? {}).map((ods) => [
      props.useDbName ? ods.dbName : ods.id,
      {
        value: props.useDbName ? ods.dbName : ods.id,
        label: ods.displayName,
      },
    ])
  );
  return (
    <SelectWrapper control={control} name={name} options={options} isLoading={odss.isFetching} />
  );
};

export const SelectEdorg = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(
  props: FormPickerTypeProps<
    TFieldValues,
    TName,
    true,
    TenantOptions.Optional,
    { useEdorgId?: boolean | undefined }
  >
) => {
  const { control, name, tenantId, sbeId } = props;
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
                    props.useEdorgId ? edorg.educationOrganizationId : edorg.id,
                    {
                      value: props.useEdorgId ? edorg.educationOrganizationId : edorg.id,
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
      control={control}
      name={name}
      options={options}
      isLoading={edorgs.isFetching}
      filterApplied={filterApplied}
      onFilterDoubleClick={() => setInclude(enumValues(EdorgType))}
      filterPane={
        discriminators.length ? (
          discriminators.map((d) => (
            <Checkbox
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
