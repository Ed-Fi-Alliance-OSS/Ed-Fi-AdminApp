import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  chakra,
} from '@chakra-ui/react';
import { GetSbeDto, PutSbeDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { usePopBanner } from '../../Layout/FeedbackBanner';

import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { sbeQueries } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutSbeDto);

export const EditSbe = (props: { sbe: GetSbeDto }) => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const goToView = () => navigate(`/sbes/${props.sbe.id}`);
  const putSbe = sbeQueries.usePut({ callback: goToView });
  const { sbe } = props;
  const sbeFormDefaults: PutSbeDto = {
    name: props.sbe.displayName,
    id: props.sbe.id,
  };
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PutSbeDto>({ resolver, defaultValues: sbeFormDefaults });

  return sbe ? (
    <chakra.form
      w="form-width"
      onSubmit={handleSubmit((data) =>
        putSbe
          .mutateAsync(
            {
              ...data,
            },
            mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError })
          )
          .catch(noop)
      )}
    >
      <FormControl isInvalid={!!errors.name}>
        <FormLabel>Name</FormLabel>
        <Input {...register('name')} />
        <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
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
  ) : null;
};
