import { Badge, BadgeProps, Box, Flex, IconButton, StyleProps, Text } from '@chakra-ui/react';
import { GetClaimsetSingleDtoV3, GetResourceClaimDtoV3 } from '@edanalytics/models';
import { CellContext, ColumnDef } from '@tanstack/react-table';
import uniq from 'lodash/uniq';
import { useMemo } from 'react';
import { SbaaTableAllInOne, useSbaaTableContext } from '../sbaaTable';
import { Icons } from '../Icons';

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

type ResourceClaimRow = GetResourceClaimDtoV3 & {
  id: string; // claimName serves as unique identifier
  actionsMap: Record<string, { default?: string; override?: string; enabled?: boolean }>;
  subRows: ResourceClaimRow[];
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
          icon={<Icons.CaretRightFill />}
        />
      )}
      {props.row.original.name}
    </Box>
  );
};

// V3's resourceClaims arrive as a flat list joined by parentClaimName/claimName
// rather than V2's nested `children` array (see 530-design.md). Build a
// lookup once, keyed by each entry's own claimName, so both root-finding and
// child-lookup are O(1) instead of re-scanning the array per node.
const groupByParent = (resourceClaims: GetResourceClaimDtoV3[]) => {
  const byParent = new Map<string | null, GetResourceClaimDtoV3[]>();
  resourceClaims.forEach((rc) => {
    const key = rc.parentClaimName;
    if (!byParent.has(key)) {
      byParent.set(key, []);
    }
    byParent.get(key)!.push(rc);
  });
  return byParent;
};

const extractActions = (
  rc: GetResourceClaimDtoV3,
  byParent: Map<string | null, GetResourceClaimDtoV3[]>
): string[] => {
  const children = byParent.get(rc.claimName) ?? [];
  return [
    ...rc.authorizationStrategyOverrides.map((as) => as.actionName),
    ...rc._defaultAuthorizationStrategies.map((as) => as.actionName),
    ...rc.actions.map((a) => a.name),
    ...children.flatMap((child) => extractActions(child, byParent)),
  ];
};
const mapRows = (
  rc: GetResourceClaimDtoV3,
  byParent: Map<string | null, GetResourceClaimDtoV3[]>
) => {
  const children = byParent.get(rc.claimName) ?? [];
  const output: ResourceClaimRow = {
    ...rc,
    id: rc.claimName,
    actionsMap: {},
    subRows: children.map((child) => mapRows(child, byParent)),
  };
  rc.actions.forEach((action) => {
    if (!output.actionsMap[action.name]) {
      output.actionsMap[action.name] = {};
    }
    output.actionsMap[action.name].enabled = action.enabled;
  });

  rc.authorizationStrategyOverrides.forEach((aso) => {
    if (!output.actionsMap[aso.actionName]) {
      output.actionsMap[aso.actionName] = {};
    }
    output.actionsMap[aso.actionName].override = aso.authorizationStrategies[0]?.authStrategyName;
  });

  rc._defaultAuthorizationStrategies.forEach((asd) => {
    if (!output.actionsMap[asd.actionName]) {
      output.actionsMap[asd.actionName] = {};
    }
    output.actionsMap[asd.actionName].default = asd.authorizationStrategies[0]?.authStrategyName;
  });

  return output;
};
const actionSortOrder = ['Read', 'Create', 'Update', 'Delete', 'ReadChanges'];

export const ResourceClaimsTableV3 = ({ claimset }: { claimset: GetClaimsetSingleDtoV3 }) => {
  const { data, columns } = useMemo(() => {
    const byParent = groupByParent(claimset.resourceClaims);
    const roots = byParent.get(null) ?? [];
    // TODO this dynamic-ness is to accommodate buggy Admin API (want to include even unexpected actions). It probably ought to be hardcoded. Revisit eventually.
    const uniqueActions = uniq(roots.flatMap((rc) => extractActions(rc, byParent))).sort(
      (actionA, actionB) => actionSortOrder.indexOf(actionA) - actionSortOrder.indexOf(actionB)
    );
    const columns: ColumnDef<ResourceClaimRow>[] = [
      {
        accessorKey: 'name',
        header: NameHeader,
        cell: NameCell,
      },
      ...uniqueActions.map((action) => ({
        id: action,
        header: action,
        accessorFn: (rc: ResourceClaimRow) => {
          const rcAction = rc.actionsMap[action];
          return rcAction?.enabled ? rcAction.override ?? rcAction.default ?? 'Unknown' : 'Denied';
        },
        cell: (ctx: CellContext<ResourceClaimRow, unknown>) => (
          <AuthStrategyBadge
            authOverride={ctx.row.original.actionsMap[action]?.override ?? null}
            authDefault={ctx.row.original.actionsMap[action]?.default ?? null}
            hasAtAll={ctx.row.original.actionsMap[action]?.enabled ?? false}
          />
        ),
        meta: {
          type: 'options' as const,
        },
      })),
    ];
    return {
      uniqueActions,
      data: roots.map((rc) => mapRows(rc, byParent)),
      columns,
    };
  }, [claimset]);
  return (
    <>
      <SbaaTableAllInOne useSubRows data={data} columns={columns} />
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
