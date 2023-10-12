import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Text,
} from '@chakra-ui/react';
import { GetOwnershipDto, PutOwnershipDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { ownershipQueries, tenantQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers';
import { SelectRole } from '../../helpers/FormPickers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutOwnershipDto);

export const EditOwnershipGlobal = (props: { ownership: GetOwnershipDto }) => {
  const { ownership } = props;
  const tenants = tenantQueries.useAll({});
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const params = useParams() as {
    ownershipId: string;
  };
  const goToView = () => navigate(`/ownerships/${params.ownershipId}`);
  const putOwnership = ownershipQueries.usePut({
    callback: goToView,
  });
  const ownershipFormDefaults: Partial<PutOwnershipDto> = new PutOwnershipDto();
  ownershipFormDefaults.id = ownership?.id;
  ownershipFormDefaults.roleId = ownership?.roleId ?? undefined;
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver,
    defaultValues: ownershipFormDefaults,
  });

  return (
    <form
      onSubmit={handleSubmit((data) => {
        const validatedData = data as PutOwnershipDto;
        return putOwnership
          .mutateAsync(
            {
              id: validatedData.id,
              roleId: validatedData.roleId,
            },
            mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError })
          )
          .catch(noop);
      })}
    >
      <FormLabel as="p">Tenant</FormLabel>
      <Text>{getRelationDisplayName(ownership.tenantId, tenants)}</Text>
      <FormLabel as="p">Resource</FormLabel>
      <Text>
        {ownership.edorg
          ? ownership.edorg.displayName
          : ownership.ods
          ? ownership.ods.displayName
          : ownership.sbe
          ? ownership.sbe.displayName
          : '-'}
      </Text>
      <FormControl w="form-width" isInvalid={!!errors.roleId}>
        <FormLabel>Role</FormLabel>
        <SelectRole
          types={[RoleType.ResourceOwnership]}
          tenantId={undefined}
          name={'roleId'}
          control={control}
        />
        <FormErrorMessage>{errors.roleId?.message}</FormErrorMessage>
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
    </form>
  );
};
