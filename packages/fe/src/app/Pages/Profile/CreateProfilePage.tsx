import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Text,
  chakra,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostProfileDtoV2 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { profileQueriesV2 } from '../../api';
import { useNavToParent, useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useState } from 'react';

const resolver = classValidatorResolver(PostProfileDtoV2);

export const CreateProfile = () => {
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const [nameAttribute, setNameAttribute] = useState<string>('No profile selected');
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/profiles/${id}`
    );
  const parentPath = useNavToParent();
  const postProfile = profileQueriesV2.post({
    edfiTenant,
    teamId,
  });

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PostProfileDtoV2>({ resolver, defaultValues: {} });

  const handleFileChange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        //@ts-expect-error result is always string
        const text = event.target?.result?.replace(/\\"/g, '"') || '';
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text as string, 'application/xml');
        const profileElement = xmlDoc.querySelector('Profile');
        const profileName = profileElement ? profileElement.getAttribute('name') : null;
        if (profileName) {
          setNameAttribute(profileName);
        }
        setValue('name', profileName as string);
        setValue('definition', text as string);
      };
      reader.readAsText(file);
    }
  };
  return (
    <PageTemplate constrainWidth title={'Create new profile'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postProfile
              .mutateAsync(
                { entity: data },
                {
                  ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
                  onSuccess: (result) => {
                    queryClient.invalidateQueries({ queryKey: ['me', 'profiles'] });
                    goToView(result.id);
                  },
                }
              )
              .catch(noop)
          )}
        >
          <FormControl isInvalid={!!errors.name}>
            <FormLabel>Name</FormLabel>
            <Text {...register('name')}>{nameAttribute}</Text>
            <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.definition}>
            <FormLabel>Definition</FormLabel>
            <chakra.input
              title="file upload"
              type="file"
              accept=".xml"
              onChange={handleFileChange}
            />
            <FormErrorMessage>{errors.definition?.message}</FormErrorMessage>
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
      </Box>
    </PageTemplate>
  );
};
