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
import { GetSbeDto, PutSbeMeta } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';

import { noop } from '@tanstack/react-table';
import { useSbeEditSbMeta } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutSbeMeta);

export const EditSbeMeta = (props: { sbe: GetSbeDto }) => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const goToView = () => navigate(`/sbes/${props.sbe.id}`);
  const putSbe = useSbeEditSbMeta(goToView);
  const { sbe } = props;
  const sbeFormDefaults: PutSbeMeta = {
    id: sbe.id,
    metaKey: sbe.configPublic?.sbeMetaKey,
    arn: sbe.configPublic?.sbeMetaArn,
  };
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PutSbeMeta>({ resolver, defaultValues: sbeFormDefaults });

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
      <FormControl isInvalid={!!errors.arn}>
        <FormLabel>SB Meta ARN</FormLabel>
        <Input {...register('arn')} placeholder="arn:aws:lambda:us..." />
        <FormErrorMessage>{errors.arn?.message}</FormErrorMessage>
      </FormControl>
      {import.meta.env.VITE_RUNNING_LOCALLY ? (
        <>
          <FormControl isInvalid={!!errors.metaKey}>
            <FormLabel>SB Meta key</FormLabel>
            <Input {...register('metaKey')} placeholder="key" />
            <FormErrorMessage>{errors.metaKey?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.metaSecret}>
            <FormLabel>SB Meta Secret</FormLabel>
            <Input {...register('metaSecret')} placeholder="adminApiKey" />
            <FormErrorMessage>{errors.metaSecret?.message}</FormErrorMessage>
          </FormControl>
        </>
      ) : null}
      <ButtonGroup>
        <Button mt={4} colorScheme="teal" isLoading={isSubmitting} type="submit">
          Connect
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
