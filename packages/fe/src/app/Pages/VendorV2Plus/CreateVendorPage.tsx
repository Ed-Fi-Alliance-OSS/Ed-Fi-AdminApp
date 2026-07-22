import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  Tooltip,
  chakra,
} from '@chakra-ui/react';
import { Icons, PageTemplate } from '@edanalytics/common-ui';
import { Id, PostVendorDtoV2 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { vendorQueriesV2 } from '../../api';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PostVendorDtoV2);

export const CreateVendorV2 = () => {
  const { teamId, edfiTenant, edfiTenantId } = useTeamEdfiTenantNavContextLoaded();
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/vendors/${id}`
    );
  const parentPath = useNavToParent();
  const postVendor = vendorQueriesV2.post({
    edfiTenant,
    teamId,
  });
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PostVendorDtoV2>({ resolver, defaultValues: {} });

  return (
    <PageTemplate constrainWidth title={'Create new vendor'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postVendor
              .mutateAsync(
                { entity: data },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
                  onSuccess: (data: typeof Id) => {
                    // The npm run build:fe failed for some reason in github action, so I included this change
                    queryClient.invalidateQueries({ queryKey: ['me', 'vendors'] });
                    // If data is a class, instantiate it; otherwise, access id directly
                    const id = (data instanceof Id) ? data.id : 0;
                    goToView(id);
                  },
                }
              )
              .catch(noop)
          )}
        >
          <FormControl isInvalid={!!errors.company}>
            <FormLabel>Company</FormLabel>
            <Input {...register('company')} />
            <FormErrorMessage>{errors.company?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.namespacePrefixes}>
            <FormLabel>
              Namespace prefixes{' '}
              <Tooltip
                label="Vendors can be associated with multiple namespaces. Please enter all possible namespace associations for this vendor, separated by commas."
                hasArrow
              >
                <chakra.span>
                  <Icons.InfoCircle />
                </chakra.span>
              </Tooltip>
            </FormLabel>
            <Input {...register('namespacePrefixes')} placeholder="uri://ed-fi.org, uri://..." />
            <FormErrorMessage>{errors.namespacePrefixes?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.contactName}>
            <FormLabel>Contact name</FormLabel>
            <Input {...register('contactName')} />
            <FormErrorMessage>{errors.contactName?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.contactEmailAddress}>
            <FormLabel>Contact email address</FormLabel>
            <Input {...register('contactEmailAddress')} />
            <FormErrorMessage>{errors.contactEmailAddress?.message}</FormErrorMessage>
          </FormControl>
          <ButtonGroup>
            <Button mt={4} colorScheme="primary" isLoading={isSubmitting} type="submit">
              Save
            </Button>
            <Button
              mt={4}
              colorScheme="primary"
              variant="ghost"
              isLoading={isSubmitting}
              type="reset"
              onClick={() => navigate(parentPath)}
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
  );
};
