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
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { tenantQueries } from '../../api';
import { useQueryClient } from '@tanstack/react-query';

const resolver = classValidatorResolver(PutTenantDto);

export const EditTenant = () => {
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
    formState: { errors, isLoading },
  } = useForm<PutTenantDto>({ resolver, defaultValues: { ...tenant } });

  return tenant ? (
    <form
      onSubmit={handleSubmit((data) =>
        putTenant.mutate(data, {
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
        <Button mt={4} colorScheme="teal" isLoading={isLoading} type="submit">
          Save
        </Button>
        <Button
          mt={4}
          colorScheme="teal"
          variant="ghost"
          isLoading={isLoading}
          type="reset"
          onClick={goToView}
        >
          Cancel
        </Button>
      </ButtonGroup>
    </form>
  ) : null;
};
