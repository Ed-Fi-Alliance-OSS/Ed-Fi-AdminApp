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
import { PageTemplate } from '@edanalytics/common-ui';
import { GetEdorgDto, PostApplicationFormDtoV2, edorgKeyV2 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { BsInfoCircle, BsTrash } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { applicationQueriesV2, edorgQueries, profileQueriesV2 } from '../../api';
import {
  getRelationDisplayName,
  useNavToParent,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import {
  SelectClaimsetV2,
  SelectEdorg,
  SelectOds,
  SelectProfile,
  SelectVendorV2,
} from '../../helpers/EntitySelectors';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SelectIntegrationProvider } from '../IntegrationProvider/SelectIntegrationProvider';
import { QUERY_KEYS } from '../../api-v2';
const resolver = classValidatorResolver(PostApplicationFormDtoV2);

export const CreateApplicationPageV2 = () => {
  const navigate = useNavigate();
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navToParentOptions = useNavToParent();
  const popGlobalBanner = usePopBanner();
  const { mutateAsync: postApplication } = applicationQueriesV2.post({
    edfiTenant: edfiTenant,
    teamId: asId,
  });
  const edorgs = useQuery(edorgQueries.getAll({ edfiTenant, teamId: asId }));
  const profiles = useQuery(profileQueriesV2.getAll({ edfiTenant, teamId: asId }));

  const queryClient = useQueryClient();

  const edorgsByEdorgId = useMemo(() => {
    return {
      data: Object.values(edorgs.data ?? {}).reduce<Record<string, GetEdorgDto>>((map, edorg) => {
        map[edorgKeyV2({ edorg: edorg.educationOrganizationId, ods: edorg.odsInstanceId })] = edorg;
        return map;
      }, {}),
    };
  }, [edorgs.data]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
    watch,
    setValue,
    control,
  } = useForm<PostApplicationFormDtoV2>({
    resolver,
    defaultValues: new PostApplicationFormDtoV2(),
  });

  const selectedOds = watch('odsInstanceId');

  const selectedEdorgs = watch('educationOrganizationIds', []);
  const setSelectedEdorgs = (edorgs: number[]) => setValue('educationOrganizationIds', edorgs);
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
      Object.entries(filteredEdorgs).map(([, v]) => [
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

  const selectedProfileIds = watch('profileIds', []);
  const setSelectedProfiles = (profiles: number[]) => setValue('profileIds', profiles);
  const filteredProfileOptions = useMemo(() => {
    const filteredProfiles = { ...profiles.data };
    const selectedProfiles = new Set(selectedProfileIds);

    Object.values(filteredProfiles || {}).forEach((profile) => {
      if (selectedProfiles.has(profile.id)) {
        delete filteredProfiles[profile.id];
      }
    });
    return Object.fromEntries(
      Object.entries(filteredProfiles).map(([, { id, name }]) => [id, { value: id, label: name }])
    );
  }, [profiles.data, selectedProfileIds]);

  const onSubmit = async (data: PostApplicationFormDtoV2) => {
    return postApplication(
      { entity: data },
      {
        onSuccess({ id: appId, link: state }) {
          queryClient.invalidateQueries({
            queryKey: [
              QUERY_KEYS.team,
              asId,
              QUERY_KEYS.edfiTenants,
              edfiTenantId,
              QUERY_KEYS.applications,
            ],
          });
          navigate(
            `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${appId}`,
            { state }
          );
        },
        ...mutationErrCallback({ popGlobalBanner, setFormError }),
      }
    ).catch(() => {});
  };

  return (
    <PageTemplate title="New application">
      <chakra.form w="form-width" onSubmit={handleSubmit(onSubmit)}>
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
                  onChange={(edorgId) => setSelectedEdorgs([...selectedEdorgs, Number(edorgId)])}
                  useEdorgId
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
                isDisabled={selectedOds === undefined}
                onChange={(edorgId) => setSelectedEdorgs([Number(edorgId)])}
                useEdorgId
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
          {selectedProfileIds?.length ? (
            <Box my={4}>
              <FormLabel>Profiles</FormLabel>
              <Box ml={4} mb={6}>
                <UnorderedList fontSize="sm">
                  {selectedProfileIds?.map((profileId, i) => (
                    <ListItem key={profileId}>
                      <Text as="span">{profiles.data?.[profileId].name}</Text>
                      &nbsp;&nbsp;
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
                onChange={(profileId) =>
                  setSelectedProfiles([...(selectedProfileIds || []), profileId])
                }
                value={selectedProfileIds?.[0]}
              />
            </>
          )}
        </FormControl>

        <FormControl isInvalid={!!errors.integrationProviderId}>
          <FormLabel>Integration Provider</FormLabel>
          <SelectIntegrationProvider name="integrationProviderId" control={control} />
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
          <Button
            variant="ghost"
            isLoading={isSubmitting}
            type="reset"
            onClick={() => {
              navigate(navToParentOptions);
            }}
          >
            Cancel
          </Button>
        </ButtonGroup>
        {errors.root?.message ? (
          <Text mt={4} color="red.500">
            {errors.root?.message}
          </Text>
        ) : null}
      </chakra.form>
    </PageTemplate>
  );
};
