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
import { useNavigate } from '@tanstack/router';
import { useForm } from 'react-hook-form';
import { useMe, usePutMe } from '../../api';

const resolver = classValidatorResolver(PutUserDto);

export const EditAccount = () => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      search: {},
    });
  };
  const putMe = usePutMe(goToView);
  const me = useMe();
  const user = me.data?.user;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutUserDto>({ resolver, defaultValues: user });

  return user ? (
    <form onSubmit={handleSubmit((data) => putMe.mutate(data))}>
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
          type="submit"
          onClick={goToView}
        >
          Cancel
        </Button>
      </ButtonGroup>
    </form>
  ) : null;
};
