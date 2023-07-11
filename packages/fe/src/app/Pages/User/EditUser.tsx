import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { PutUserDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { userQueries } from '../../api';

const resolver = classValidatorResolver(PutUserDto);

export const EditUser = () => {
  const navigate = useNavigate();
  const params = useParams() as {
    asId: string;
    userId: string;
  };
  const goToView = () => navigate(`/as/${params.asId}/users/${params.userId}`);
  const putUser = userQueries.usePut({
    callback: goToView,
    tenantId: params.asId,
  });
  const user = userQueries.useOne({
    id: params.userId,
    tenantId: params.asId,
  }).data;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutUserDto>({ resolver, defaultValues: { ...user } });

  return user ? (
    <form onSubmit={handleSubmit((data) => putUser.mutate(data))}>
      {/* TODO: replace this with real content */}
      <FormControl isInvalid={!!errors.givenName}>
        <FormLabel>Given Name</FormLabel>
        <Input {...register('givenName')} placeholder="givenName" />
        <FormErrorMessage>{errors.givenName?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.familyName}>
        <FormLabel>Family Name</FormLabel>
        <Input {...register('familyName')} placeholder="familyName" />
        <FormErrorMessage>{errors.familyName?.message}</FormErrorMessage>
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
