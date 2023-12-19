import {
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  chakra,
} from '@chakra-ui/react';
import { GetUserDto, PutUserDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { tenantQueries, userQueries } from '../../api';
import { SelectRole } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutUserDto);

export const EditUserGlobal = (props: { user: GetUserDto }) => {
  const popBanner = usePopBanner();

  const { user } = props;
  const tenants = tenantQueries.useAll({});

  const navigate = useNavigate();
  const params = useParams() as {
    userId: string;
  };
  const goToView = () => navigate(`/users/${params.userId}`);
  const putUser = userQueries.usePut({
    callback: goToView,
  });
  const userFormDefaults: Partial<PutUserDto> = new PutUserDto();
  userFormDefaults.id = user.id;
  userFormDefaults.roleId = user.roleId;
  userFormDefaults.givenName = user.givenName;
  userFormDefaults.familyName = user.familyName;
  userFormDefaults.username = user.username;
  userFormDefaults.isActive = user.isActive;
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver,
    defaultValues: userFormDefaults,
  });

  return (
    <chakra.form
      maxW="form-width"
      onSubmit={handleSubmit((data) => {
        const validatedData = data as PutUserDto;
        return putUser
          .mutateAsync(
            {
              id: validatedData.id,
              roleId: validatedData.roleId,
              isActive: validatedData.isActive,
              username: validatedData.username,
              givenName: validatedData.givenName === '' ? null : validatedData.givenName,
              familyName: validatedData.familyName === '' ? null : validatedData.familyName,
            },
            mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError })
          )
          .catch(noop);
      })}
    >
      <FormControl isInvalid={!!errors.username}>
        <FormLabel>Username</FormLabel>
        <Input {...register('username')} placeholder="username" />
        <FormErrorMessage>{errors.username?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.givenName}>
        <FormLabel>Given name</FormLabel>
        <Input {...register('givenName')} placeholder="givenName" />
        <FormErrorMessage>{errors.givenName?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.familyName}>
        <FormLabel>Family name</FormLabel>
        <Input {...register('familyName')} placeholder="familyName" />
        <FormErrorMessage>{errors.familyName?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.isActive}>
        <FormLabel>Status</FormLabel>
        <Checkbox {...register('isActive')}>Is active</Checkbox>
        <FormErrorMessage>{errors.isActive?.message}</FormErrorMessage>
      </FormControl>
      <FormControl w="form-width" isInvalid={!!errors.roleId}>
        <FormLabel>Role</FormLabel>
        <SelectRole types={[RoleType.UserGlobal]} name={'roleId'} control={control} isClearable />
        <FormErrorMessage>{errors.roleId?.message}</FormErrorMessage>
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
  );
};
