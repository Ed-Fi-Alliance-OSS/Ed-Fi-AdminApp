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
import { useNavigate } from 'react-router-dom';
import _ from 'lodash';
import { useForm } from 'react-hook-form';
import { useSbeRegisterAdminApi } from '../../api';
import { sbeGlobalRoute } from '../../routes';

const resolver = classValidatorResolver(PutSbeAdminApiRegister);

export const RegisterSbeAdminApiAuto = (props: { sbe: GetSbeDto }) => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      to: sbeGlobalRoute.fullPath,
      params: (old: any) => old,
      search: (old: any) => _.omit(old, 'edit'),
    });
  };
  const putSbe = useSbeRegisterAdminApi(goToView);
  const { sbe } = props;
  const sbeFormDefaults: PutSbeAdminApiRegister = {
    id: sbe.id,
    adminRegisterUrl: sbe.configPublic?.adminApiUrl,
  };
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutSbeAdminApiRegister>({
    resolver,
    defaultValues: sbeFormDefaults,
  });

  return sbe ? (
    <>
      <form
        onSubmit={handleSubmit((data) =>
          putSbe.mutate({
            ...data,
          })
        )}
      >
        <FormControl isInvalid={!!errors.adminRegisterUrl}>
          <FormLabel>Admin API URL</FormLabel>
          <Input {...register('adminRegisterUrl')} placeholder="URL" />
          <FormErrorMessage>{errors.adminRegisterUrl?.message}</FormErrorMessage>
        </FormControl>
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
    </>
  ) : null;
};
