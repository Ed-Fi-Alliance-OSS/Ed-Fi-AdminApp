import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { GetSbeDto, PutSbeMeta } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useSbeEditAdminApi, useSbeEditSbMeta } from '../../api';
import { sbeGlobalRoute } from '../../routes';
import _ from 'lodash';

const resolver = classValidatorResolver(PutSbeMeta);

export const EditSbeMeta = (props: { sbe: GetSbeDto }) => {
  const navigate = useNavigate();
  const params = useParams() as { sbeId: string };
  const goToView = () => navigate(`/sbes/${params.sbeId}`);
  const putSbe = useSbeEditSbMeta(goToView);
  const { sbe } = props;
  const sbeFormDefaults: PutSbeMeta = {
    id: sbe.id,
    metaKey: sbe.configPublic?.sbeMetaKey,
    metaUrl: sbe.configPublic?.sbeMetaUrl,
  };
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutSbeMeta>({ resolver, defaultValues: sbeFormDefaults });

  return sbe ? (
    <form
      onSubmit={handleSubmit((data) =>
        putSbe.mutate({
          ...data,
        })
      )}
    >
      <FormControl isInvalid={!!errors.metaUrl}>
        <FormLabel>SB Meta URL</FormLabel>
        <Input {...register('metaUrl')} placeholder="URL" />
        <FormErrorMessage>{errors.metaUrl?.message}</FormErrorMessage>
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
        <Button mt={4} colorScheme="teal" isLoading={isLoading} type="submit">
          Connect
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
