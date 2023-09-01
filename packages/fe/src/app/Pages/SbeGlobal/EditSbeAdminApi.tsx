import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { GetSbeDto, PutSbeAdminApi } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { usePopBanner } from '../../Layout/FeedbackBanner';

import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useSbeEditAdminApi } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutSbeAdminApi);

export const EditSbeAdminApi = (props: { sbe: GetSbeDto }) => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const params = useParams() as { sbeId: string };
  const goToView = () => navigate(`/sbes/${params.sbeId}`);
  const putSbe = useSbeEditAdminApi(goToView);
  const { sbe } = props;
  const sbeFormDefaults: PutSbeAdminApi = {
    id: sbe.id,
    adminKey: sbe.configPublic?.adminApiKey,
    adminUrl: sbe.configPublic?.adminApiUrl,
  };
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PutSbeAdminApi>({ resolver, defaultValues: sbeFormDefaults });

  return sbe ? (
    <form
      onSubmit={handleSubmit((data) =>
        putSbe.mutateAsync(
          {
            ...data,
          },
          mutationErrCallback({ popBanner, setError })
        )
      )}
    >
      <FormControl isInvalid={!!errors.adminUrl}>
        <FormLabel>Admin API URL</FormLabel>
        <Input {...register('adminUrl')} placeholder="URL" />
        <FormErrorMessage>{errors.adminUrl?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.adminKey}>
        <FormLabel>Admin API key</FormLabel>
        <Input {...register('adminKey')} placeholder="key" />
        <FormErrorMessage>{errors.adminKey?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.adminSecret}>
        <FormLabel>Admin API Secret</FormLabel>
        <Input {...register('adminSecret')} placeholder="adminApiKey" />
        <FormErrorMessage>{errors.adminSecret?.message}</FormErrorMessage>
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
    </form>
  ) : null;
};
