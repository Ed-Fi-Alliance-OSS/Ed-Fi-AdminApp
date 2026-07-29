import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
  chakra,
} from '@chakra-ui/react';
import { GetProfileDtoV2, PutProfileDtoV2 } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { profileQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useState } from 'react';

const resolver = classValidatorResolver(PutProfileDtoV2);

export const EditProfile = (props: { profile: GetProfileDtoV2 }) => {
  const popBanner = usePopBanner();
  const [nameAttribute, setNameAttribute] = useState<string>('No profile selected');

  const navigate = useNavigate();
  const params = useParams() as {
    profileId: string;
  };
  const { teamId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const goToView = () =>
    navigate(
      `/as/${teamId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/profiles/${params.profileId}`
    );
  const putProfile = profileQueriesV2.put({
    edfiTenant,
    teamId,
  });

  const {
    register,
    setError,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PutProfileDtoV2>({
    resolver,
    defaultValues: Object.assign(new PutProfileDtoV2(), props.profile),
  });
  const handleFileChange = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result || '';
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
  return props.profile ? (
    <chakra.form
      w="form-width"
      onSubmit={handleSubmit((data) =>
        putProfile
          .mutateAsync(
            { entity: data },
            {
              ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
              onSuccess: goToView,
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
        <chakra.input title="file upload" type="file" accept=".xml" onChange={handleFileChange} />
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
          onClick={goToView}
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
  ) : null;
};
