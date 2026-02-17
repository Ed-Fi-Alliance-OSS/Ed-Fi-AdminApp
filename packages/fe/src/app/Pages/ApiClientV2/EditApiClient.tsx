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
import {
  GetApiClientDtoV2,
  PutApiClientFormDtoV2,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  applicationQueriesV2,
} from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import {
  SelectOds,
} from '../../helpers/EntitySelectors';

const resolver = classValidatorResolver(PutApiClientFormDtoV2);

export const EditApiClient = (props: {
  apiClient: GetApiClientDtoV2;
}) => {
  const { apiClient } = props;
  const { edfiTenantId, edfiTenant, teamId, asId } = useTeamEdfiTenantNavContextLoaded();

  const navigate = useNavigate();
  const goToView = () => {
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/1/apiclients/${apiClient.id}`
    );
  };

  const defaultValues = new PutApiClientFormDtoV2();
  defaultValues.id = apiClient.id;
  defaultValues.name = apiClient.name;
  defaultValues.isApproved = apiClient.isApproved;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    watch,
    setError: setFormError,
  } = useForm<PutApiClientFormDtoV2>({
    resolver,
    defaultValues,
  });

  const selectedOds = watch('odsInstanceId');
  
  const onSubmit = async (data: PutApiClientFormDtoV2) => {
    navigate(
      `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/1/apiclients/${apiClient.id}`,
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Box w="form-width">
        <FormControl isInvalid={!!errors.name}>
          <FormLabel>Name</FormLabel>
          <Input {...register('name')} placeholder="name" />
          <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.isApproved}>
          <FormLabel></FormLabel>
          <Checkbox {...register('isApproved')}>Enabled</Checkbox>
          <FormErrorMessage>{errors.isApproved?.message}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.odsInstanceId}>
          <FormLabel>ODS</FormLabel>
          <SelectOds
            useInstanceId
            value={selectedOds}
            onChange={(value) => {
              setValue('odsInstanceId', value);
            }}
          />
          <FormErrorMessage>{errors.odsInstanceId?.message}</FormErrorMessage>
        </FormControl>

        <FormControl>
          <FormLabel>Use Sandbox</FormLabel>
          <Text>{apiClient.useSandbox ? 'Yes' : 'No'}</Text>
        </FormControl>

        <FormControl>
          <FormLabel>Status</FormLabel>
          <Text>{apiClient.keyStatus}</Text>
        </FormControl>

        <FormControl>
          <FormLabel>Client id</FormLabel>
          <Text>{apiClient.key}</Text>
        </FormControl>

        <ButtonGroup mt={4} colorScheme="primary">
          <Button isLoading={isSubmitting} type="submit">
            Save
          </Button>
          <Button variant="ghost" isLoading={isSubmitting} type="reset" onClick={goToView}>
            Cancel
          </Button>
        </ButtonGroup>
        {errors.root?.message ? (
          <Text mt={4} color="red.500">
            {errors.root?.message}
          </Text>
        ) : null}
      </Box>
    </form>
  );
};
