import {
  Button,
  ButtonGroup,
  FormControl,
  FormLabel,
  Input,
  Switch,
  Text,
} from '@chakra-ui/react';
import { GetApiClientDtoV2 } from '@edanalytics/models';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { SelectOds } from '../../helpers/EntitySelectors';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';

type EditApiClientFormValues = {
  id: number;
  name: string;
  key: string;
  keyStatus: string;
  isApproved: boolean;
  applicationId: number;
  odsInstanceId: number;
};

export const EditApiClient = (props: { apiClient: GetApiClientDtoV2 }) => {
  const { apiClient } = props;
  const { teamId, edfiTenant, edfiTenantId } = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();

  const goToView = () => {
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/${apiClient.applicationId}/apiclients/${apiClient.id}`
    );
  };

  const {
    register,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<EditApiClientFormValues>({
    defaultValues: {
      id: apiClient.id,
      name: apiClient.name,
      key: apiClient.key,
      keyStatus: apiClient.keyStatus,
      isApproved: apiClient.isApproved,
      applicationId: apiClient.applicationId,
      odsInstanceId: apiClient.odsInstanceIds[0],
    },
  });

  const selectedOds = watch('odsInstanceId');

  return (
    <form>
      <FormControl>
        <FormLabel>Name</FormLabel>
        <Input {...register('name')} />
      </FormControl>

      <FormControl>
        <FormLabel>Enabled</FormLabel>
        <Switch {...register('isApproved')} />
      </FormControl>

      <FormControl>
        <FormLabel>ODS</FormLabel>
        <SelectOds
          useInstanceId
          value={selectedOds}
          onChange={(value) => setValue('odsInstanceId', value)}
        />
      </FormControl>

      <FormControl>
        <FormLabel>Key</FormLabel>
        <Text>{apiClient.key}</Text>
      </FormControl>

      <FormControl>
        <FormLabel>Status</FormLabel>
        <Text>{apiClient.keyStatus}</Text>
      </FormControl>

      <ButtonGroup mt={4} colorScheme="primary">
        <Button isDisabled type="button">
          Save
        </Button>
        <Button variant="ghost" isLoading={isSubmitting} type="reset" onClick={goToView}>
          Cancel
        </Button>
      </ButtonGroup>

      <Text mt={4} color="gray.500" fontSize="sm">
        Saving edits will be enabled in the next step.
      </Text>
    </form>
  );
};
