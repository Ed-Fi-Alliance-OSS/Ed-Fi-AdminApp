import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostSbeDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { sbeQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { usePopBanner } from '../../Layout/FeedbackBanner';

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
      <Box w="20em">
        <form
          onSubmit={handleSubmit((data) =>
            postSbe.mutateAsync(
              {
                ...data,
              },
              {
                onSuccess: (result) => {
                  navigate(`/sbes/${result.id}`);
                },
                ...mutationErrCallback({ setError, popBanner }),
              }
            )
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
        </form>
      </Box>
    </PageTemplate>
  );
};
