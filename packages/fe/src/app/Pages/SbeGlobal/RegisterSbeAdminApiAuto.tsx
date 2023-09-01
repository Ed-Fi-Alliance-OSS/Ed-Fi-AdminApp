import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { GetSbeDto, PutSbeAdminApiRegister } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useSbeRegisterAdminApi } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutSbeAdminApiRegister);

export const RegisterSbeAdminApiAuto = (props: { sbe: GetSbeDto }) => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate(`/sbes/${props.sbe.id}`);
  };
  const putSbe = useSbeRegisterAdminApi(goToView);
  const { sbe } = props;
  const sbeFormDefaults: PutSbeAdminApiRegister = {
    id: sbe.id,
    adminRegisterUrl: sbe.configPublic?.adminApiUrl,
  };
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PutSbeAdminApiRegister>({
    resolver,
    defaultValues: sbeFormDefaults,
  });

  const popBanner = usePopBanner();

  return sbe ? (
    <form
      onSubmit={handleSubmit((data) =>
        putSbe.mutateAsync(
          {
            ...data,
          },
          mutationErrCallback({ setError, popBanner })
        )
      )}
    >
      <FormControl isInvalid={!!errors.adminRegisterUrl}>
        <FormLabel>Admin API URL</FormLabel>
        <Input {...register('adminRegisterUrl')} placeholder="URL" />
        <FormErrorMessage>{errors.adminRegisterUrl?.message}</FormErrorMessage>
      </FormControl>
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
    </form>
  ) : null;
};
