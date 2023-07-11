import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { PutRoleDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { roleQueries } from '../../api';

const resolver = classValidatorResolver(PutRoleDto);

export const EditRole = () => {
  const navigate = useNavigate();
  const params = useParams() as {
    asId: string;
    roleId: string;
  };
  const goToView = () => navigate(`/as/${params.asId}/roles/${params.roleId}`);
  const putRole = roleQueries.usePut({
    callback: goToView,
    tenantId: params.asId,
  });
  const role = roleQueries.useOne({
    id: params.roleId,
    tenantId: params.asId,
  }).data;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutRoleDto>({ resolver, defaultValues: { ...role } });

  return role ? (
    <form onSubmit={handleSubmit((data) => putRole.mutate(data))}>
      {/* TODO: replace this with real content */}
      <FormControl isInvalid={!!errors.id}>
        <FormLabel>Id</FormLabel>
        <Input {...register('id')} placeholder="id" />
        <FormErrorMessage>{errors.id?.message}</FormErrorMessage>
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
