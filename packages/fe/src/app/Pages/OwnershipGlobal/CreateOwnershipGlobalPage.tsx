import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import {
  GetEdfiTenantDto,
  GetEdorgDto,
  PostOwnershipDto,
  RoleType,
  edorgKeyV2,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { plainToInstance } from 'class-transformer';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import {
  edfiTenantQueriesGlobal,
  edorgQueries,
  ownershipQueries,
  sbEnvironmentQueries,
  teamQueries,
} from '../../api';
import {
  EdfiTenantNavContextLoader,
  NavContextLoader,
  NavContextProvider,
  SelectEdfiTenant,
  SelectEdorg,
  SelectOds,
  SelectRole,
  SelectSbEnvironment,
  SelectTeam,
  useNavToParent,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';

const resolver = classValidatorResolver(PostOwnershipDto);

const getDefaults = (dict: {
  edfiTenantId?: string;
  sbEnvironmentId?: string;
  teamId?: string;
  type?: 'ods' | 'edorg' | 'edfiTenant' | 'environment';
}) => {
  return {
    edfiTenantId: 'edfiTenantId' in dict ? Number(dict.edfiTenantId) : undefined,
    sbEnvironmentId: 'sbEnvironmentId' in dict ? Number(dict.sbEnvironmentId) : undefined,
    teamId: 'teamId' in dict ? Number(dict.teamId) : undefined,
    type: 'type' in dict ? dict.type : 'ods',
  };
};

export const CreateOwnershipGlobalPage = () => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();
  const goToView = (id: string | number) => navigate(`/ownerships/${id}`);

  const teams = useQuery(teamQueries.getAll({}));
  const sbEnvironments = useQuery(sbEnvironmentQueries.getAll({}));

  const search = useSearchParamsObject(getDefaults);
  const popBanner = usePopBanner();

  const postOwnership = ownershipQueries.post({});
  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    watch,
    setError,
  } = useForm({
    resolver,
    defaultValues: useMemo(() => Object.assign(new PostOwnershipDto(), search), [search]),
  });

  const [sbEnvironmentId, edfiTenantId, type, selectedOdsId] = watch([
    'sbEnvironmentId',
    'edfiTenantId',
    'type',
    'odsId',
  ]);
  const { data: edfiTenant } = useQuery(
    edfiTenantQueriesGlobal.getOne({
      id: edfiTenantId,
      sbEnvironmentId: sbEnvironmentId,
      enabled: !!edfiTenantId,
    })
  );
  const edorgs = useQuery(
    edorgQueries.getAll({
      edfiTenant: edfiTenant || ({} as GetEdfiTenantDto),
      enabled: !!edfiTenant?.id,
    })
  );
  const filteredEdorgOptions = useMemo(() => {
    const filteredEdorgs = { ...edorgs.data };
    return Object.fromEntries(
      Object.entries(filteredEdorgs)
        .filter(([key, v]) => v.odsId === Number(selectedOdsId))
        .map(([key, v]) => [
          v.id,
          {
            value: v.id,
            label: v.displayName,
            subLabel: `${v.educationOrganizationId} ${v.discriminatorShort}`,
            discriminator: v.discriminator,
          },
        ])
    );
  }, [edorgs, selectedOdsId]);
  return teams.data && sbEnvironments.data ? (
    <PageTemplate title={'Grant new resource ownership'} actions={undefined}>
      <Box maxW="form-width">
        <FormLabel>Resource type</FormLabel>
        <RadioGroup
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange={(value: any) => {
            setValue('type', value);
            if (value === 'environment') {
              setValue('edfiTenantId', undefined);
              setValue('odsId', undefined);
              setValue('edorgId', undefined);
            }
            if (value === 'edfiTenant') {
              setValue('odsId', undefined);
              setValue('edorgId', undefined);
            }
            if (value === 'ods') {
              setValue('edorgId', undefined);
            }
            if (value === 'edorg') {
              setValue('odsId', undefined);
            }
          }}
          value={type}
        >
          <Stack direction="column" pl="1em" spacing={1}>
            <Radio value="edorg">Ed-Org</Radio>
            <Radio value="ods">Ods</Radio>
            <Radio value="edfiTenant">Tenant</Radio>
            <Radio value="environment">Whole environment</Radio>
          </Stack>
        </RadioGroup>
        <form
          onSubmit={handleSubmit((data) => {
            const body = plainToInstance(PostOwnershipDto, data);
            if (type !== 'edfiTenant') {
              body.edfiTenantId = undefined;
            }
            if (type !== 'ods') {
              body.odsId = undefined;
            }
            if (type !== 'environment') {
              body.sbEnvironmentId = undefined;
            }
            return postOwnership
              .mutateAsync(
                { entity: body },
                {
                  ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
                  onSuccess: (result) => {
                    goToView(result.id);
                  },
                }
              )
              .catch(noop);
          })}
        >
          <FormControl
            isInvalid={
              !!errors.hasResource && (sbEnvironmentId === undefined || type === 'environment')
            }
          >
            <FormLabel>Starting Blocks environment</FormLabel>
            <SelectSbEnvironment name="sbEnvironmentId" control={control} />
            <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
          </FormControl>
          {type !== undefined && type !== 'environment' && typeof sbEnvironmentId === 'number' && (
            <NavContextProvider sbEnvironmentId={sbEnvironmentId}>
              <NavContextLoader fallback={null}>
                <FormControl
                  isInvalid={
                    !!errors.hasResource &&
                    (typeof edfiTenantId !== 'number' || type === 'edfiTenant')
                  }
                >
                  <FormLabel>Tenant</FormLabel>
                  <SelectEdfiTenant autoSelectOnly name="edfiTenantId" control={control} />
                  <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
                </FormControl>
                {(type === 'ods' || type === 'edorg') && typeof edfiTenantId === 'number' ? (
                  <NavContextProvider edfiTenantId={edfiTenantId}>
                    <EdfiTenantNavContextLoader fallback={null}>
                      {type === 'ods' ? (
                        <FormControl isInvalid={!!errors.hasResource}>
                          <FormLabel>ODS</FormLabel>
                          <SelectOds control={control} name="odsId" useDbName={false} />
                          <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
                        </FormControl>
                      ) : null}
                      {type === 'edorg' ? (
                        <>
                          <FormControl isInvalid={!!errors.hasResource}>
                            <FormLabel>ODS</FormLabel>
                            <SelectOds control={control} name="odsId" useDbName={false} />
                            <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
                          </FormControl>
                          <FormControl isInvalid={!!errors.hasResource}>
                            <FormLabel>Ed-Org</FormLabel>
                            <SelectEdorg
                              isDisabled={!selectedOdsId}
                              options={filteredEdorgOptions}
                              control={control}
                              name="edorgId"
                              useEdorgId={false}
                            />
                            <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
                          </FormControl>
                        </>
                      ) : null}
                    </EdfiTenantNavContextLoader>
                  </NavContextProvider>
                ) : null}
              </NavContextLoader>
            </NavContextProvider>
          )}
          <FormControl isInvalid={!!errors.teamId}>
            <FormLabel>Team</FormLabel>
            <SelectTeam name="teamId" control={control} />
            <FormErrorMessage>{errors.teamId?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.roleId}>
            <FormLabel>Role</FormLabel>
            <SelectRole
              name="roleId"
              types={[RoleType.ResourceOwnership]}
              control={control}
              isClearable
            />
            <FormErrorMessage>{errors.roleId?.message}</FormErrorMessage>
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
        </form>
      </Box>
    </PageTemplate>
  ) : null;
};
