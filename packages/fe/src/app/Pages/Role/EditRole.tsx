import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import { GetRoleDto, PutRoleDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { roleQueries } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutRoleDto);

export const EditRole = (props: { role: GetRoleDto }) => {
  const popBanner = usePopBanner();
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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<PutRoleDto>({
    resolver,
    defaultValues: { ...props.role, privileges: props.role.privileges.map((p) => p.code) },
  });

  return (
    <form
      onSubmit={handleSubmit((data) =>
        putRole
          .mutateAsync(
            data,
            mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError })
          )
          .catch(noop)
      )}
    >
      <FormControl isInvalid={!!errors.id}>
        <FormLabel>Id</FormLabel>
        <Input {...register('id')} placeholder="id" />
        <FormErrorMessage>{errors.id?.message}</FormErrorMessage>
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
    </form>
  );
};
