import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostOdsDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { odsQueries } from '../../api';
import {
  SelectOdsTemplate,
  useNavToParent,
  useTeamEdfiTenantNavContextLoaded,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PostOdsDto);

export const CreateOds = () => {
  const popBanner = usePopBanner();
  const params = useTeamEdfiTenantNavContextLoaded();
  const navigate = useNavigate();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${params.asId}/sb-environments/${params.sbEnvironmentId}/edfi-tenants/${params.edfiTenantId}/odss/${id}`
    );
  const parentPath = useNavToParent();
  const postOds = odsQueries.post({
    edfiTenant: params.edfiTenant,
    teamId: params.asId,
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PostOdsDto>({
    resolver,
    defaultValues: Object.assign(new PostOdsDto(), {}),
  });

  return (
    <PageTemplate title={'Create new ODS'} actions={undefined}>
      <form
        onSubmit={handleSubmit((data) =>
          postOds
            .mutateAsync(
              { entity: data },
              {
                ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
                onSuccess: (result) => {
                  goToView(result.id);
                },
              }
            )
            .catch(noop)
        )}
      >
        <FormControl w="form-width" isInvalid={!!errors.name}>
          <FormLabel>Name</FormLabel>
          <Input {...register('name')} />
          <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
        </FormControl>
        <FormControl w="form-width" isInvalid={!!errors.templateName}>
          <FormLabel>Template</FormLabel>
          <SelectOdsTemplate name="templateName" control={control} />
          <FormErrorMessage>{errors.templateName?.message}</FormErrorMessage>
        </FormControl>
        <ButtonGroup>
          <Button mt={4} colorScheme="primary" isLoading={isSubmitting} type="submit">
            Save
          </Button>
          <Button
            mt={4}
            colorScheme="primary"
            variant="ghost"
            isLoading={isSubmitting}
            type="reset"
            onClick={() => navigate(parentPath)}
          >
            Cancel
          </Button>
        </ButtonGroup>
        {errors.root?.message ? (
          <Text mt={4} color="red.500">
            {errors.root?.message}
          </Text>
        ) : null}
      </form>
    </PageTemplate>
  );
};
