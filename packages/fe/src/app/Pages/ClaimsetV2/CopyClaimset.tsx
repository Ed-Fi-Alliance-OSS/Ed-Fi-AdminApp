import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import {
  CopyClaimsetDtoV2,
  GetClaimsetMultipleDtoV2,
  GetClaimsetSingleDtoV2,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { claimsetQueriesV2 } from '../../api';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(CopyClaimsetDtoV2);

export const CopyClaimsetForm = ({
  claimset,
}: {
  claimset: GetClaimsetSingleDtoV2 | GetClaimsetMultipleDtoV2;
}) => {
  const popBanner = usePopBanner();
  const navToParentOptions = useNavToParent();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/claimsets/${id}`
    );
  const navigate = useNavigate();
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const postClaimsetCopy = claimsetQueriesV2.copy({ edfiTenant, teamId });
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CopyClaimsetDtoV2>({
    resolver,
    defaultValues: Object.assign(new CopyClaimsetDtoV2(), {
      originalId: claimset.id,
      name: claimset.name + ' (copy)',
    }),
  });

  return (
    <Box w="form-width">
      <form
        onSubmit={handleSubmit((data) =>
          postClaimsetCopy
            .mutateAsync(
              { entity: data, pathParams: {} },
              {
                onSuccess: (result) => {
                  goToView(result.id);
                },
                ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
              }
            )
            .catch(noop)
        )}
      >
        <FormControl isInvalid={!!errors.name}>
          <FormLabel>Name</FormLabel>
          <Input {...register('name')} placeholder="name" />
          <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
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
  );
};

export const CopyClaimsetPage = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const { claimsetId } = useParams();
  const claimset = useQuery(
    claimsetQueriesV2.getOne({ id: Number(claimsetId), edfiTenant, teamId })
  );
  return (
    <PageTemplate title={'Copy ' + (claimset.data?.name ?? 'claimset')} actions={undefined}>
      {claimset.data ? <CopyClaimsetForm claimset={claimset.data} /> : null}
    </PageTemplate>
  );
};
