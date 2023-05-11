import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { PutEdorgDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useNavigate, useParams } from '@tanstack/router';
import { useForm } from 'react-hook-form';
import { edorgQueries } from '../../api';
import { edorgIndexRoute, edorgRoute } from '../../routes';

const resolver = classValidatorResolver(PutEdorgDto);

export const EditEdorg = () => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      to: edorgRoute.fullPath,
      params: (old: any) => old,
      search: {},
    });
  };
  const params = useParams({ from: edorgIndexRoute.id });
  const putEdorg = edorgQueries.usePut({
    callback: goToView,
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const edorg = edorgQueries.useOne({
    id: params.edorgId,
    tenantId: params.asId,
    sbeId: params.sbeId,
  }).data;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutEdorgDto>({ resolver, defaultValues: { ...edorg } });

  return edorg ? (
    <form onSubmit={handleSubmit((data) => putEdorg.mutate(data))}>
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
