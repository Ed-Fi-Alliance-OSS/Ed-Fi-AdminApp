import { Badge, BadgeProps, Flex, StyleProps, Tooltip } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
  SbaaTableAllInOne,
} from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { claimsetQueries } from '../../api';

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
const ViewClaimset = () => {
  const params = useParams() as {
    asId: string;
    sbeId: string;
    claimsetId: string;
  };
  const claimset = claimsetQueries.useOne({
    id: params.claimsetId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;

  return claimset ? (
    <>
      <ContentSection
        css={{
          '& div.react-json-view': {
            background: 'transparent!important',
          },
        }}
      >
        <AttributesGrid>
          <AttributeContainer label="Is system-reserved">
            <Tooltip
              hasArrow
              label="System-reserved claimsets cannot be used to create applications."
            >
              <span>{String(!!claimset.isSystemReserved)}</span>
            </Tooltip>
          </AttributeContainer>
          <Attribute label="Applications" value={claimset.applicationsCount} />
        </AttributesGrid>
      </ContentSection>
      <ContentSection heading="Resource claims">
        <SbaaTableAllInOne
          data={claimset.resourceClaims.map((rc) => {
            // Sometimes the length is other than 4, which is a bug. We need to just return 'unknown' in that case.
            const defaults =
              rc.defaultAuthStrategiesForCRUD.length === 4
                ? rc.defaultAuthStrategiesForCRUD
                : undefined;
            return {
              ...rc,
              id: rc.name,
              createDefault: rc.create ? defaults?.[0]?.authStrategyName ?? null : null,
              readDefault: rc.read ? defaults?.[1]?.authStrategyName ?? null : null,
              updateDefault: rc.update ? defaults?.[2]?.authStrategyName ?? null : null,
              deleteDefault: rc.delete ? defaults?.[3]?.authStrategyName ?? null : null,
              createOverride: rc.create
                ? rc.authStrategyOverridesForCRUD[0]?.authStrategyName ?? null
                : null,
              readOverride: rc.read
                ? rc.authStrategyOverridesForCRUD[1]?.authStrategyName ?? null
                : null,
              updateOverride: rc.update
                ? rc.authStrategyOverridesForCRUD[2]?.authStrategyName ?? null
                : null,
              deleteOverride: rc.delete
                ? rc.authStrategyOverridesForCRUD[3]?.authStrategyName ?? null
                : null,
            };
          })}
          columns={[
            {
              accessorKey: 'name',
              header: 'Name',
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
      </ContentSection>
    </>
  ) : null;
};

export default ViewClaimset;
