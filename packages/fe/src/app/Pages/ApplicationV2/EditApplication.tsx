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
  GetIntegrationAppDto,
  PutApplicationFormDtoV2,
  edorgKeyV2,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { BsInfoCircle, BsTrash } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import {
  applicationQueriesV2,
  claimsetQueriesV2,
  edorgQueries,
  profileQueriesV2,
  queryKey,
} from '../../api';
import { getRelationDisplayName, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import {
  SelectClaimsetV2,
  SelectEdorg,
  SelectOds,
  SelectProfile,
  SelectVendorV2,
} from '../../helpers/EntitySelectors';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { SelectIntegrationProvider } from '../IntegrationProvider/SelectIntegrationProvider';
import { QUERY_KEYS } from '../../api-v2';

const resolver = classValidatorResolver(PutApplicationFormDtoV2);

export const EditApplication = (props: {
  application: GetApplicationDtoV2 & GetIntegrationAppDto;
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
  const profiles = useQuery(profileQueriesV2.getAll({ edfiTenant, teamId }));
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

  const { mutateAsync: putApplication } = applicationQueriesV2.put({
    edfiTenant,
    teamId,
  });
  const queryClient = useQueryClient();
  const popGlobalBanner = usePopBanner();

  const navigate = useNavigate();
  const goToView = () => {
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${application.id}`
    );
  };

  const defaultValues = new PutApplicationFormDtoV2();
  defaultValues.id = application.id;
  defaultValues.applicationName = application.applicationName;
  defaultValues.claimsetId = claimset?.id as number;
  defaultValues.integrationProviderId = application.integrationProviderId;
  defaultValues.profileIds = application.profileIds;
  defaultValues.vendorId = application.vendorId;
  defaultValues.educationOrganizationIds = application.educationOrganizationIds;
  defaultValues.odsInstanceId = application.odsInstanceIds[0];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    watch,
    setError: setFormError,
  } = useForm<PutApplicationFormDtoV2>({
    resolver,
    defaultValues,
  });

  const selectedEdorgs = watch('educationOrganizationIds', defaultValues.educationOrganizationIds);
  const selectedProfileIds = watch('profileIds', defaultValues.profileIds) || [];
  const selectedOds = watch('odsInstanceId');
  const setSelectedEdorgs = (edorgs: number[]) => {
    setValue('educationOrganizationIds', edorgs);
  };
  const setSelectedProfiles = (profiles: number[]) => {
    setValue('profileIds', profiles);
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

  const filteredProfileOptions = useMemo(() => {
    const filteredProfiles = { ...profiles.data };
    const selectedProfiles = new Set(selectedProfileIds);

    Object.values(filteredProfiles || {}).forEach((profile) => {
      if (selectedProfiles.has(profile.id)) {
        delete filteredProfiles[profile.id];
      }
    });
    return Object.fromEntries(
      Object.entries(filteredProfiles).map(([, v]) => [v.id, { value: v.id, label: v.name }])
    );
  }, [profiles.data, selectedProfileIds]);

  const onSubmit = async (data: PutApplicationFormDtoV2) => {
    return putApplication(
      { entity: data },
      {
        onSuccess() {
          queryClient.invalidateQueries({
            queryKey: [
              QUERY_KEYS.team,
              teamId,
              QUERY_KEYS.edfiTenants,
              edfiTenantId,
              QUERY_KEYS.applications,
            ],
          });
          queryClient.invalidateQueries({
            queryKey: queryKey({
              resourceName: 'Claimset',
              teamId: teamId,
              edfiTenantId: edfiTenantId,
            }),
          });
          goToView();
        },
        ...mutationErrCallback({ popGlobalBanner, setFormError }),
      }
    ).catch(() => {});
  };

  const hasIntegrationProvider = !!application.integrationProviderId;

  return edorgs.data && claimsets.data ? (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Box w="form-width">
        {hasIntegrationProvider && (
          <Text>
            Integration Applications do not allow the editing of:
            <br />
            ODS, Ed-orgs, or Integration Providers.
          </Text>
        )}
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
            isDisabled={hasIntegrationProvider}
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
                      <Text as="span" mr={2}>
                        {getRelationDisplayName(
                          edorgKeyV2({ edorg: edorgId, ods: selectedOds }),
                          edorgsByEdorgId
                        )}
                      </Text>
                      {!hasIntegrationProvider && (
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
                      )}
                    </ListItem>
                  ))}
                </UnorderedList>
                <FormLabel>Add another</FormLabel>
                <SelectEdorg
                  useEdorgId
                  onChange={(edorgId) => setSelectedEdorgs([...selectedEdorgs, Number(edorgId)])}
                  value={undefined}
                  options={filteredEdorgOptions}
                  isDisabled={hasIntegrationProvider}
                />
              </Box>
              <Divider mt={6} />
            </Box>
          ) : (
            <>
              <FormLabel>Ed-org</FormLabel>
              <SelectEdorg
                useEdorgId
                isDisabled={selectedOds === undefined || hasIntegrationProvider}
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
          {selectedProfileIds.length ? (
            <Box my={4}>
              <FormLabel>Profiles</FormLabel>
              <Box ml={4} mb={6}>
                <UnorderedList fontSize="sm">
                  {selectedProfileIds?.map((profileId, i) => (
                    <ListItem key={profileId}>
                      <Text as="span" mr={2}>
                        {profiles.data?.[profileId].name}
                      </Text>
                      <IconButton
                        variant="ghost"
                        colorScheme="red"
                        aria-label="remove"
                        icon={<Icon as={BsTrash} />}
                        size="xs"
                        onClick={() => {
                          const newSelection = [...selectedProfileIds];
                          newSelection.splice(i, 1);
                          setSelectedProfiles(newSelection);
                        }}
                      />
                    </ListItem>
                  ))}
                </UnorderedList>
                <FormLabel>Add another</FormLabel>
                <SelectProfile
                  onChange={(profileId) => setSelectedProfiles([...selectedProfileIds, profileId])}
                  value={undefined}
                  options={filteredProfileOptions}
                />
              </Box>
              <Divider mt={6} />
            </Box>
          ) : (
            <>
              <FormLabel>Profile</FormLabel>
              <SelectProfile
                onChange={(profileId) => setSelectedProfiles([...selectedProfileIds, profileId])}
                value={selectedProfileIds[0]}
              />
            </>
          )}
        </FormControl>

        <FormControl isInvalid={!!errors.integrationProviderId}>
          <FormLabel>Integration Provider</FormLabel>
          <SelectIntegrationProvider
            name="integrationProviderId"
            control={control}
            isDisabled={hasIntegrationProvider}
          />
          <FormErrorMessage>{errors.integrationProviderId?.message}</FormErrorMessage>
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
