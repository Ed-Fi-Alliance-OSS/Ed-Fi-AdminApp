import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Select,
  Text,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostOdsDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useEffect } from 'react';
import { Resolver, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { odsQueries } from '../../api';
import {
  useNavToParent,
  useTeamEdfiTenantNavContextLoaded,
  SelectOdsTemplate,
} from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { sampleOdsData } from '../Ods/odsData';

const baseResolver = classValidatorResolver(PostOdsDto);

const resolver: Resolver<PostOdsDto> = async (data, context, options) => {
  const result = await baseResolver(data, context, options);
  if (!result.errors.name) {
    const isDuplicate = sampleOdsData.some(
      (row) =>
        row.name.toLowerCase() === data.name?.toLowerCase() &&
        row.type === data.templateName
    );
    if (isDuplicate) {
      result.errors.name = {
        type: 'manual',
        message: 'An ODS with this name and type already exists.',
      };
    }
  }
  return result;
};

export const CreateOds = () => {
  const popBanner = usePopBanner();
  const params = useTeamEdfiTenantNavContextLoaded();
  const { edfiTenant, sbEnvironment, teamId } = useTeamEdfiTenantNavContextLoaded();
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
    watch,
    trigger,
    formState: { errors, isSubmitting, touchedFields },
  } = useForm<PostOdsDto>({
    resolver,
    defaultValues: Object.assign(new PostOdsDto(), {}),
  });

  const selectedType = watch('templateName');

  useEffect(() => {
    if (touchedFields.name) {
      trigger('name');
    }
  }, [selectedType, trigger, touchedFields.name]);

  return (
    <PageTemplate title={'Create new Data Store'} actions={undefined}>
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
        {sbEnvironment.startingBlocks && (
          <FormControl w="form-width" isInvalid={!!errors.templateName}>
            <FormLabel>Template</FormLabel>
            <SelectOdsTemplate name="templateName" control={control} />
            <FormErrorMessage>{errors.templateName?.message}</FormErrorMessage>
          </FormControl>
        )}
        <FormControl w="form-width" isInvalid={!!errors.templateName}>
          <FormLabel>Type</FormLabel>
          <Select placeholder="Select type" {...register('templateName')}>
            <option value="Minimal">Minimal</option>
            <option value="Sample">Sample</option>
          </Select>
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
