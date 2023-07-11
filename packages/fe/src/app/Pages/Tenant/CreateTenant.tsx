import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { PostTenantDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { tenantQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { PageTemplate } from '../PageTemplate';
import { useQueryClient } from '@tanstack/react-query';

const resolver = classValidatorResolver(PostTenantDto);

export const CreateTenant = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) => navigate(`/tenants/${id}`);
  const parentPath = useNavToParent();
  const putTenant = tenantQueries.usePost({
    callback: (result) => goToView(result.id),
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PostTenantDto>({ resolver, defaultValues: {} });

  return (
    <PageTemplate constrainWidth title={'Create new tenant'} actions={undefined}>
      <Box w="20em">
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
              onClick={() => navigate(parentPath)}
            >
              Cancel
            </Button>
          </ButtonGroup>
        </form>
      </Box>
    </PageTemplate>
  );
};
