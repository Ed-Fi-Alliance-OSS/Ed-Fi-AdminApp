import { Box, Text, useBoolean } from '@chakra-ui/react';
import { GetTenantDto } from '@edanalytics/models';
import { useQueryClient } from '@tanstack/react-query';
import { Select } from 'chakra-react-select';
import { atom, useAtom } from 'jotai';
import Cookies from 'js-cookie';
import { Resizable } from 're-resizable';
import { useEffect } from 'react';
import { BsPerson, BsPersonFill } from 'react-icons/bs';
import { useMatches, useNavigate, useParams } from 'react-router-dom';
import { useMyTenants } from '../api';
import {
  authorize,
  globalOwnershipAuthConfig,
  globalSbeAuthConfig,
  globalTenantAuthConfig,
  globalUserAuthConfig,
  usePrivilegeCacheForConfig,
} from '../helpers';
import { GlobalNav } from './GlobalNav';
import { NavButton } from './NavButton';
import { TenantNav } from './TenantNav';

export const asTenantIdAtom = atom<number | undefined>(undefined);

export const Nav = () => {
  const params = useParams();

  const defaultTenant: any = params?.asId ?? Cookies.get('defaultTenant');
  const [tenantId, setTenantId] = useAtom(asTenantIdAtom);

  const tenants = useMyTenants();
  const currentMatches = useMatches();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const globalAuthConfigs = [
    globalTenantAuthConfig('tenant:read'),
    globalOwnershipAuthConfig('ownership:read'),
    globalUserAuthConfig('user:read'),
    globalSbeAuthConfig('__filtered__', 'sbe:read'),
  ];
  usePrivilegeCacheForConfig(globalAuthConfigs);

  const hasGlobalPrivileges = globalAuthConfigs.some((config) =>
    authorize({
      queryClient,
      config,
    })
  );
  const selectedTenant = tenantId === undefined ? undefined : tenants.data?.[tenantId];
  const isInTenantContext = currentMatches.some((m) => m.pathname.startsWith('/as/'));
  const tenantsCount = Object.keys(tenants.data || {}).length;
  const firstTenantId: string | undefined = Object.keys(tenants.data || {})?.[0];

  // Set initial tenantId
  useEffect(() => {
    setTenantId(
      typeof defaultTenant === 'string' && defaultTenant !== 'undefined' && defaultTenant !== 'NaN'
        ? Number(defaultTenant)
        : undefined
    );
  }, []);

  // Keep cookie in sync with JS state
  useEffect(() => {
    Cookies.set('defaultTenant', String(tenantId));
  }, [tenantId]);

  useEffect(() => {
    if (
      // if we're on a tenant route
      params.asId &&
      // and tenant state isn't synced with it yet
      String(tenantId) !== params.asId
    ) {
      // then sync it up
      setTenantId(Number(params.asId));
    }
  }, [tenantId, currentMatches, setTenantId, params.asId]);

  useEffect(() => {
    if (
      // if you only have one tenant
      tenantsCount === 1 &&
      // and you don't have any global privileges
      !hasGlobalPrivileges &&
      // and your tenant isn't already set
      params.asId === undefined
    ) {
      // then set it
      setTenantId(Number(firstTenantId));
    }
  }, [tenantsCount, firstTenantId, hasGlobalPrivileges, params.asId, setTenantId]);

  const [isResizing, setIsResizing] = useBoolean(false);

  return (
    <Box
      pb={3}
      pt={8}
      flex="0 0 20em"
      overflowX="hidden"
      overflowY="auto"
      bg="foreground-bg"
      enable={{ right: true }}
      defaultSize={{ width: '15em', height: '100%' }}
      onResizeStart={setIsResizing.on}
      onResizeStop={setIsResizing.off}
      borderRightWidth={isResizing ? '3px' : undefined}
      borderRightColor={isResizing ? 'teal.500' : undefined}
      minWidth="11em"
      maxWidth="min(40em, 80%)"
      as={Resizable}
    >
      {Object.keys(tenants.data ?? {}).length > 1 || hasGlobalPrivileges ? (
        <Box mb={7} px={3}>
          <Select
            aria-label="Select a tenant (or global) context"
            value={
              selectedTenant === undefined
                ? {
                    label: 'No tenant (global)',
                    value: undefined,
                    styles: {
                      fontWeight: '600',
                      color: 'gray.600',
                      fontSize: 'md',
                    },
                  }
                : {
                    label: selectedTenant.displayName,
                    value: selectedTenant.id,
                  }
            }
            onChange={(option) => {
              const value = option?.value ?? undefined;
              const newTenantId = value === undefined ? undefined : Number(value);
              if (newTenantId !== undefined) {
                navigate(`/as/${newTenantId}`);
              } else {
                if (isInTenantContext) {
                  navigate('/');
                  setTenantId(newTenantId);
                } else {
                  setTenantId(newTenantId);
                }
              }
            }}
            options={[
              {
                label: 'No tenant (global)',
                value: undefined,
                styles: {
                  fontWeight: '600',
                  color: 'gray.600',
                  fontSize: 'md',
                },
              },
              ...Object.values(tenants.data ?? ({} as Record<string, GetTenantDto>))
                .sort((a, b) => Number(a.displayName > b.displayName) - 0.5)
                .map((t) => ({
                  label: t.displayName,
                  value: t.id,
                })),
            ]}
            selectedOptionStyle="check"
            chakraStyles={{
              option: (styles, { data, isDisabled, isFocused, isSelected }) => {
                return {
                  ...styles,
                  ...data?.styles,
                };
              },
              singleValue: (styles, { data, isDisabled }) => {
                return {
                  ...styles,
                  ...data?.styles,
                };
              },
              container: (styles) => ({
                ...styles,
                bg: 'transparent',
                borderRadius: 'md',
                zIndex: 3,
              }),
              dropdownIndicator: (styles) => ({
                ...styles,
                bg: 'none',
                width: '1.5em',
              }),
              indicatorSeparator: (styles) => ({
                ...styles,
                borderColor: 'transparent',
              }),
            }}
          />
        </Box>
      ) : null}
      <NavButton
        {...{
          route: '/account',
          icon: BsPerson,
          activeIcon: BsPersonFill,
          text: 'Account',
          isActive: currentMatches.some((m) => m.pathname.startsWith('/account')),
        }}
      />
      {tenantId === undefined ? <GlobalNav /> : <TenantNav tenantId={String(tenantId)} />}
    </Box>
  );
};
