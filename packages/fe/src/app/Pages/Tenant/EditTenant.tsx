import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { PutTenantDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { usePopBanner } from '../../Layout/FeedbackBanner';

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
    <form
      onSubmit={handleSubmit((data) =>
        putTenant.mutateAsync(data, {
          ...mutationErrCallback({ popBanner, setError }),
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['me', 'tenants'] });
          },
        })
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
    </form>
  ) : null;
};
