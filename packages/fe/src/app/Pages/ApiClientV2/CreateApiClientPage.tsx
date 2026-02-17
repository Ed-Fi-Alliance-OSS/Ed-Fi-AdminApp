import {
  Button,
  ButtonGroup,
  Checkbox,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  chakra,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostApiClientFormDtoV2, PostApplicationFormDtoV2 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  useNavToParent,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import {
  SelectOds,
} from '../../helpers/EntitySelectors';
const resolver = classValidatorResolver(PostApplicationFormDtoV2);

export const CreateApiClientPageV2 = () => {
  const navigate = useNavigate();
  const { edfiTenantId, asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const navToParentOptions = useNavToParent();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError: setFormError,
    watch,
    setValue,
    control,
  } = useForm<PostApiClientFormDtoV2>({
    resolver,
    defaultValues: new PostApiClientFormDtoV2(),
  });

  const selectedOds = watch('odsInstanceId');

  const onSubmit = async (data: PostApiClientFormDtoV2) => {
    navigate(
      `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenantId}/applications/1/apiclients/1`,
    );
  };

  return (
    <PageTemplate title="New application credentials">
      <chakra.form w="form-width" onSubmit={handleSubmit(onSubmit)}>
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

        <ButtonGroup mt={4} colorScheme="primary">
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
        {errors.root?.message ? (
          <Text mt={4} color="red.500">
            {errors.root?.message}
          </Text>
        ) : null}
      </chakra.form>
    </PageTemplate>
  );
};
