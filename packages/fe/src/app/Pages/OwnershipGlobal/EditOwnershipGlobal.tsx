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
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ownershipQueries, tenantQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers';
import { SelectRole } from '../../helpers/FormPickers';

const resolver = classValidatorResolver(PutOwnershipDto);

export const EditOwnershipGlobal = (props: { ownership: GetOwnershipDto }) => {
  const { ownership } = props;
  const tenants = tenantQueries.useAll({});

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
    formState: { errors, isLoading },
  } = useForm({
    resolver,
    defaultValues: ownershipFormDefaults,
  });

  return (
    <form
      onSubmit={handleSubmit((data) => {
        const validatedData = data as PutOwnershipDto;
        putOwnership.mutate({
          id: validatedData.id,
          roleId: validatedData.roleId,
        });
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
      <FormControl w="20em" isInvalid={!!errors.roleId}>
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
        <Button mt={4} colorScheme="teal" isLoading={isLoading} type="submit">
          Save
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
  );
};
