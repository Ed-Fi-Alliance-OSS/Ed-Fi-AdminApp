import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostUserDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { userQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { SelectRole } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PostUserDto);

export const CreateUser = () => {
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) => navigate(`/users/${id}`);
  const parentPath = useNavToParent();
  const postUser = userQueries.usePost({
    callback: (result) => goToView(result.id),
  });
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PostUserDto>({ resolver, defaultValues: {} });

  return (
    <PageTemplate constrainWidth title={'Create new user'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postUser
              .mutateAsync(data, {
                ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: ['me', 'users'] });
                },
              })
              .catch(noop)
          )}
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
            <SelectRole
              types={[RoleType.UserGlobal]}
              name={'roleId'}
              control={control}
              isClearable
            />
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
