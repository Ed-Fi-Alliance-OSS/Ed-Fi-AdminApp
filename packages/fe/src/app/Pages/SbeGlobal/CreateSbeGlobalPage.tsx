import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostSbeDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { sbeQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PostSbeDto);

export const CreateSbeGlobalPage = () => {
  const popBanner = usePopBanner();
  const navToParentOptions = useNavToParent();
  const navigate = useNavigate();
  const postSbe = sbeQueries.usePost({});
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PostSbeDto>({ resolver });

  return (
    <PageTemplate constrainWidth title={'Create Environment'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postSbe
              .mutateAsync(
                {
                  ...data,
                },
                {
                  onSuccess: (result) => {
                    navigate(`/sbes/${result.id}`);
                  },
                  ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
                }
              )
              .catch(noop)
          )}
        >
          <FormControl isInvalid={!!errors.name}>
            <FormLabel>Name</FormLabel>
            <Input {...register('name')} placeholder="name" />
            <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
          </FormControl>
          <ButtonGroup mt={4} colorScheme="teal">
            <Button isLoading={isSubmitting} type="submit">
              Save
            </Button>
            <Button
              variant="ghost"
              isLoading={isSubmitting}
              type="reset"
              onClick={() => {
                navigate(navToParentOptions);
              }}
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
