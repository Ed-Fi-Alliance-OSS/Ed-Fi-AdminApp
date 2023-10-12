import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Text,
} from '@chakra-ui/react';
import { PutUserTenantMembershipDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { roleQueries, tenantQueries, userQueries, userTenantMembershipQueries } from '../../api';
import { getRelationDisplayName } from '../../helpers';
import { SelectRole } from '../../helpers/FormPickers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutUserTenantMembershipDto);

export const EditUtmGlobal = () => {
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams() as { userTenantMembershipId: string };
  const goToView = () => navigate(`/user-tenant-memberships/${params.userTenantMembershipId}`);
  const putUserTenantMembership = userTenantMembershipQueries.usePut({
    callback: goToView,
  });
  const utm = userTenantMembershipQueries.useOne({
    id: params.userTenantMembershipId,
  }).data;
  const tenants = tenantQueries.useAll({});
  const roles = roleQueries.useAll({});
  const users = userQueries.useAll({});

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PutUserTenantMembershipDto>({ resolver, defaultValues: { ...utm } });

  return utm ? (
    <form
      onSubmit={handleSubmit((data) =>
        putUserTenantMembership
          .mutateAsync(data, {
            ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['me', 'userTenantMemberships'] });
            },
          })
          .catch(noop)
      )}
    >
      <FormLabel as="p">Tenant</FormLabel>
      <Text>{getRelationDisplayName(utm.tenantId, tenants)}</Text>
      <FormLabel as="p">User</FormLabel>
      <Text>{getRelationDisplayName(utm.userId, users)}</Text>
      <FormControl w="form-width" isInvalid={!!errors.roleId}>
        <FormLabel>Role</FormLabel>
        <SelectRole
          types={[RoleType.UserTenant]}
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
  ) : null;
};
