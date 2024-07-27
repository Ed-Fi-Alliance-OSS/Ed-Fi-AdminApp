import {
  Box,
  Button,
  ButtonGroup,
  Divider,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  IconButton,
  Input,
  ListItem,
  Text,
  Tooltip,
  UnorderedList,
  chakra,
} from '@chakra-ui/react';
import {
  GetApplicationDtoV2,
  GetClaimsetMultipleDtoV2,
  GetEdorgDto,
  PutApplicationFormDtoV2,
  edorgKeyV2,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { BsInfoCircle, BsTrash } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { applicationQueriesV2, claimsetQueriesV2, edorgQueries, queryKey } from '../../api';
import { getRelationDisplayName, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import {
  SelectClaimsetV2,
  SelectEdorg,
  SelectOds,
  SelectVendorV2,
} from '../../helpers/EntitySelectors';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { Attribute } from '@edanalytics/common-ui';

const resolver = classValidatorResolver(PutApplicationFormDtoV2);

export const EditApplication = (props: {
  application: GetApplicationDtoV2;
  claimset: GetClaimsetMultipleDtoV2 | undefined;
}) => {
  const { application, claimset } = props;
  const { edfiTenantId, edfiTenant, teamId } = useTeamEdfiTenantNavContextLoaded();
  const edorgs = useQuery(
    edorgQueries.getAll({
      edfiTenant,
      teamId,
    })
  );
  const edorgsByEdorgId = useMemo(() => {
    return {
      data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
        map[edorgKeyV2({ edorg: edorg.educationOrganizationId, ods: edorg.odsInstanceId })] = edorg;
        return map;
      }, {}),
    };
  }, [edorgs.data]);

  const claimsets = useQuery(
    claimsetQueriesV2.getAll({
      edfiTenant,
      teamId,
    })
  );

  const putApplication = applicationQueriesV2.put({
    edfiTenant,
    teamId,
  });
  const queryClient = useQueryClient();
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const goToView = () => {
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}`
    );
  };
  const defaultValues = new PutApplicationFormDtoV2();
  defaultValues.id = application.id;
  defaultValues.applicationName = application.displayName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValues.claimsetId = claimset?.id as any;
  defaultValues.profileIds = application.profileIds;
  defaultValues.vendorId = application.vendorId;
  defaultValues.educationOrganizationIds = application.educationOrganizationIds;
  defaultValues.odsInstanceId = application.odsInstanceIds[0];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formState,
    control,
    setValue,
    watch,
    setError,
    reset,
  } = useForm<PutApplicationFormDtoV2>({
    resolver,
    defaultValues,
  });

  const selectedEdorgs = watch('educationOrganizationIds', defaultValues.educationOrganizationIds);
  const selectedOds = watch('odsInstanceId');

  const setSelectedEdorgs = (edorgs: number[]) => {
    setValue('educationOrganizationIds', edorgs);
  };

  const filteredEdorgOptions = useMemo(() => {
    const filteredEdorgs = { ...edorgsByEdorgId.data };
    const selectedEdorgsSet = new Set(selectedEdorgs);

    Object.values(filteredEdorgs || {}).forEach((edorg) => {
      const compositeKey = edorgKeyV2({
        edorg: edorg.educationOrganizationId,
        ods: edorg.odsInstanceId,
      });
      if (
        // selectedEdorgs is relative to selected ODS so don't use composite key redundantly
        selectedEdorgsSet.has(edorg.educationOrganizationId) ||
        selectedOds === undefined ||
        edorg.odsInstanceId !== selectedOds
      ) {
        delete filteredEdorgs[compositeKey];
      }
    });
    return Object.fromEntries(
      Object.entries(filteredEdorgs).map(([compositeKey, v]) => [
        v.educationOrganizationId,
        {
          value: v.educationOrganizationId,
          label: v.displayName,
          subLabel: `${v.educationOrganizationId} ${v.discriminatorShort}`,
          discriminator: v.discriminator,
        },
      ])
    );
  }, [edorgsByEdorgId, selectedEdorgs, selectedOds]);

  return edorgs.data && claimsets.data ? (
    <form
      onSubmit={handleSubmit((data) => {
        return putApplication
          .mutateAsync(
            { entity: data },
            {
              onSuccess() {
                queryClient.invalidateQueries({
                  queryKey: queryKey({
                    resourceName: 'Claimset',
                    teamId: teamId,
                    edfiTenantId: edfiTenantId,
                  }),
                });
                goToView();
              },
              ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
            }
          )
          .catch(noop);
      })}
    >
      <Box w="form-width">
        <FormControl isInvalid={!!errors.applicationName}>
          <FormLabel>Application name</FormLabel>
          <Input {...register('applicationName')} placeholder="name" />
          <FormErrorMessage>{errors.applicationName?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.odsInstanceId}>
          <FormLabel>ODS</FormLabel>
          <SelectOds
            useInstanceId
            value={selectedOds}
            onChange={(value) => {
              setValue('odsInstanceId', value);
              setValue(
                'educationOrganizationIds',
                selectedEdorgs.filter(
                  (edorg) => !!edorgsByEdorgId.data[edorgKeyV2({ edorg, ods: value })]
                )
              );
            }}
          />
          <FormErrorMessage>{errors.odsInstanceId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.educationOrganizationIds}>
          {selectedEdorgs.length ? (
            <Box my={4}>
              <FormLabel>Ed-orgs</FormLabel>
              <Box ml={4} mb={6}>
                <UnorderedList fontSize="sm">
                  {selectedEdorgs.map((edorgId, i) => (
                    <ListItem key={edorgId}>
                      <Text as="span">
                        {getRelationDisplayName(
                          edorgKeyV2({ edorg: edorgId, ods: selectedOds }),
                          edorgsByEdorgId
                        )}
                      </Text>
                      &nbsp;&nbsp;
                      <IconButton
                        variant="ghost"
                        colorScheme="red"
                        aria-label="remove"
                        icon={<Icon as={BsTrash} />}
                        size="xs"
                        onClick={() => {
                          const newSelection = [...selectedEdorgs];
                          newSelection.splice(i, 1);
                          setSelectedEdorgs(newSelection);
                        }}
                      />
                    </ListItem>
                  ))}
                </UnorderedList>
                <FormLabel>Add another</FormLabel>
                <SelectEdorg
                  useEdorgId
                  onChange={(edorgId) => setSelectedEdorgs([...selectedEdorgs, Number(edorgId)])}
                  value={undefined}
                  options={filteredEdorgOptions}
                />
              </Box>
              <Divider mt={6} />
            </Box>
          ) : (
            <>
              <FormLabel>Ed-org</FormLabel>
              <SelectEdorg
                useEdorgId
                isDisabled={selectedOds === undefined}
                onChange={(edorgId) => setSelectedEdorgs([Number(edorgId)])}
                value={undefined}
                options={filteredEdorgOptions}
              />
            </>
          )}
          <FormErrorMessage>{errors.educationOrganizationIds?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.vendorId}>
          <FormLabel>Vendor</FormLabel>
          <SelectVendorV2 name="vendorId" control={control} />
          <FormErrorMessage>{errors.vendorId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl>
          <FormLabel>Profile IDs</FormLabel>
          {application.profileIds?.length ? application.profileIds.join(', ') : '-'}
        </FormControl>
        <FormControl isInvalid={!!errors.claimsetId}>
          <FormLabel>
            Claimset{' '}
            <Tooltip label="You can only select non-reserved claimsets here." hasArrow>
              <chakra.span>
                <Icon as={BsInfoCircle} />
              </chakra.span>
            </Tooltip>
          </FormLabel>
          <SelectClaimsetV2 noReserved name="claimsetId" control={control} />
          <FormErrorMessage>{errors.claimsetId?.message}</FormErrorMessage>
        </FormControl>
        <ButtonGroup mt={4} colorScheme="primary">
          <Button isLoading={isSubmitting} type="submit">
            Save
          </Button>
          <Button variant="ghost" isLoading={isSubmitting} type="reset" onClick={goToView}>
            Cancel
          </Button>
        </ButtonGroup>
        {errors.root?.message ? (
          <Text mt={4} color="red.500">
            {errors.root?.message}
          </Text>
        ) : null}
      </Box>
    </form>
  ) : null;
};
