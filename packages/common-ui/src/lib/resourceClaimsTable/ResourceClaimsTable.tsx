import { Badge, BadgeProps, Box, Flex, IconButton, StyleProps, Text } from '@chakra-ui/react';
import { GetClaimsetDto, ResourceClaimDto } from '@edanalytics/models';
import { BsCaretRightFill } from 'react-icons/bs';
import { SbaaTableAllInOne, useSbaaTableContext } from '../sbaaTable';
import { CellContext, HeaderContext } from '@tanstack/react-table';

const AuthStrategyBadge = (props: {
  authDefault: string | null;
  authOverride: string | null;
  hasAtAll: boolean;
}) => {
  const { authDefault, authOverride, hasAtAll } = props;
  const badgeProps: Partial<StyleProps & BadgeProps> = hasAtAll
    ? authOverride
      ? { colorScheme: 'blue' }
      : authDefault
      ? { colorScheme: 'gray', color: 'gray.600', fontStyle: 'italic' }
      : { colorScheme: 'orange' }
    : { colorScheme: 'red' };
  return (
    <Badge textTransform="none" {...badgeProps}>
      {hasAtAll ? authOverride ?? authDefault ?? 'Auth strategy unknown' : 'Denied'}
    </Badge>
  );
};

type ResourceClaimRow = Pick<ResourceClaimDto, 'name' | 'create' | 'read' | 'update' | 'delete'> & {
  id: string;
  createDefault: string | null;
  readDefault: string | null;
  updateDefault: string | null;
  deleteDefault: string | null;
  createOverride: string | null;
  readOverride: string | null;
  updateOverride: string | null;
  deleteOverride: string | null;
  subRows: ResourceClaimRow[];
};
const mapRc = (rc: ResourceClaimDto): ResourceClaimRow => {
  // Sometimes the length is other than 4, which is a bug. We need to just return 'unknown' in that case.
  const defaults =
    rc.defaultAuthStrategiesForCRUD.length === 4 ? rc.defaultAuthStrategiesForCRUD : undefined;
  return {
    ...rc,
    id: rc.name,
    createDefault: rc.create ? defaults?.[0]?.authStrategyName ?? null : null,
    readDefault: rc.read ? defaults?.[1]?.authStrategyName ?? null : null,
    updateDefault: rc.update ? defaults?.[2]?.authStrategyName ?? null : null,
    deleteDefault: rc.delete ? defaults?.[3]?.authStrategyName ?? null : null,
    createOverride: rc.create ? rc.authStrategyOverridesForCRUD[0]?.authStrategyName ?? null : null,
    readOverride: rc.read ? rc.authStrategyOverridesForCRUD[1]?.authStrategyName ?? null : null,
    updateOverride: rc.update ? rc.authStrategyOverridesForCRUD[2]?.authStrategyName ?? null : null,
    deleteOverride: rc.delete ? rc.authStrategyOverridesForCRUD[3]?.authStrategyName ?? null : null,
    subRows: rc.children.map(mapRc),
  };
};
const NameHeader = () => {
  const table = useSbaaTableContext().table;
  const canAnyExpand = table?.getCanSomeRowsExpand();
  return (
    <Text as="span" pl={canAnyExpand ? '20px' : undefined}>
      Name
    </Text>
  );
};
const NameCell = (props: CellContext<ResourceClaimRow, unknown>) => {
  const table = useSbaaTableContext().table;
  const canAnyExpand = table?.getCanSomeRowsExpand();
  const canThisRowExpand = props.row.getCanExpand();

  return (
    <Box
      ml={`${props.row.depth * 1.5}rem`}
      pl={canThisRowExpand || !canAnyExpand ? undefined : '20px'}
    >
      {canThisRowExpand && (
        <IconButton
          display="inline-block"
          onClick={() => props.row.toggleExpanded()}
          aria-label="open or close"
          title="open or close"
          variant="unstyled"
          w="20px"
          h="20px"
          minH="20px"
          minW="20px"
          size="xs"
          className={props.row.getIsExpanded() ? 'opened' : undefined}
          css={{
            '&.opened': {
              transition: '0.5s',
              transform: 'rotate(90deg)',
            },
            svg: {
              margin: 'auto',
            },
          }}
          icon={<BsCaretRightFill />}
        />
      )}
      {props.row.original.name}
    </Box>
  );
};
export const ResourceClaimsTable = ({ claimset }: { claimset: GetClaimsetDto }) => {
  return (
    <>
      <SbaaTableAllInOne
        useSubRows
        data={claimset.resourceClaims.map(mapRc)}
        columns={[
          {
            accessorKey: 'name',
            header: NameHeader,
            cell: NameCell,
          },
          {
            id: 'create',
            header: 'Create',
            accessorFn: (rc) =>
              rc.create
                ? rc.createOverride ?? rc.createDefault ?? 'Auth strategy unknown'
                : 'Denied',
            cell: ({ row: { original } }) => (
              <AuthStrategyBadge
                authOverride={original.createOverride}
                authDefault={original.createDefault}
                hasAtAll={original.create}
              />
            ),
            meta: {
              type: 'options',
            },
          },
          {
            id: 'read',
            header: 'Read',
            accessorFn: (rc) =>
              rc.read ? rc.readOverride ?? rc.readDefault ?? 'Auth strategy unknown' : 'Denied',
            cell: ({ row: { original } }) => (
              <AuthStrategyBadge
                authOverride={original.readOverride}
                authDefault={original.readDefault}
                hasAtAll={original.read}
              />
            ),
            meta: {
              type: 'options',
            },
          },
          {
            id: 'update',
            header: 'Update',
            accessorFn: (rc) =>
              rc.update
                ? rc.updateOverride ?? rc.updateDefault ?? 'Auth strategy unknown'
                : 'Denied',
            cell: ({ row: { original } }) => (
              <AuthStrategyBadge
                authOverride={original.updateOverride}
                authDefault={original.updateDefault}
                hasAtAll={original.update}
              />
            ),
            meta: {
              type: 'options',
            },
          },
          {
            id: 'delete',
            header: 'Delete',
            accessorFn: (rc) =>
              rc.delete
                ? rc.deleteOverride ?? rc.deleteDefault ?? 'Auth strategy unknown'
                : 'Denied',
            cell: ({ row: { original } }) => (
              <AuthStrategyBadge
                authOverride={original.deleteOverride}
                authDefault={original.deleteDefault}
                hasAtAll={original.delete}
              />
            ),
            meta: {
              type: 'options',
            },
          },
        ]}
      />
      <Flex
        borderTop="1px solid"
        borderColor="gray.200"
        mt={3}
        pt={3}
        css={{
          '& span': {
            width: 'fit-content',
          },
        }}
        gap={1}
        flexDir="column"
      >
        <AuthStrategyBadge authDefault={'Default auth strategy'} authOverride={null} hasAtAll />
        <AuthStrategyBadge authOverride={'Override auth strategy'} authDefault={null} hasAtAll />
        <AuthStrategyBadge authOverride={null} authDefault={null} hasAtAll={false} />
        <AuthStrategyBadge authOverride={null} authDefault={null} hasAtAll />
      </Flex>
    </>
  );
};
