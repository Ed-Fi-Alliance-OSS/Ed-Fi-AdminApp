import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  chakra,
} from '@chakra-ui/react';
import { PutTenantDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { usePopBanner } from '../../Layout/FeedbackBanner';

import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { tenantQueries } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutTenantDto);

export const EditTenant = () => {
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams() as { tenantId: string };
  const goToView = () => navigate(`/tenants/${params.tenantId}`);
  const putTenant = tenantQueries.usePut({
    callback: goToView,
  });
  const tenant = tenantQueries.useOne({
    id: params.tenantId,
  }).data;
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PutTenantDto>({ resolver, defaultValues: { ...tenant } });

  return tenant ? (
    <chakra.form
      maxW="form-width"
      onSubmit={handleSubmit((data) =>
        putTenant
          .mutateAsync(data, {
            ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['me', 'tenants'] });
            },
          })
          .catch(noop)
      )}
    >
      <FormControl isInvalid={!!errors.name}>
        <FormLabel>Name</FormLabel>
        <Input {...register('name')} placeholder="name" />
        <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
      </FormControl>
      <ButtonGroup>
        <Button mt={4} colorScheme="teal" isLoading={isSubmitting} type="submit">
          Save
        </Button>
        <Button
          mt={4}
          colorScheme="teal"
          variant="ghost"
          isLoading={isSubmitting}
          type="reset"
          onClick={goToView}
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
  ) : null;
};
