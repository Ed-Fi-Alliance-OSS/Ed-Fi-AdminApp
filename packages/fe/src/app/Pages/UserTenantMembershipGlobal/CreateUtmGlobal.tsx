import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostUserTenantMembershipDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { userTenantMembershipQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { SelectRole, SelectTenant, SelectUser } from '../../helpers/FormPickers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { usePopBanner } from '../../Layout/FeedbackBanner';

const resolver = classValidatorResolver(PostUserTenantMembershipDto);

const getDefaults = (dict: { userId?: string; tenantId?: string; roleId?: string }) => {
  return {
    userId: 'userId' in dict ? Number(dict.userId) : undefined,
    tenantId: 'tenantId' in dict ? Number(dict.tenantId) : undefined,
    roleId: 'roleId' in dict ? Number(dict.roleId) : undefined,
  };
};

export const CreateUtmGlobal = () => {
  const popBanner = usePopBanner();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) => navigate(`/user-tenant-memberships/${id}`);
  const parentPath = useNavToParent();
  const postUtm = userTenantMembershipQueries.usePost({
    callback: (result) => goToView(result.id),
  });

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PostUserTenantMembershipDto>({
    resolver,
    defaultValues: Object.assign(
      new PostUserTenantMembershipDto(),
      useSearchParamsObject(getDefaults)
    ),
  });

  return (
    <PageTemplate constrainWidth title={'Create new tenant membership'} actions={undefined}>
      <Box w="form-width">
        <form
          onSubmit={handleSubmit((data) =>
            postUtm.mutateAsync(
              { ...data },
              {
                onSuccess: () => {
                  queryClient.invalidateQueries({ queryKey: ['me', 'user-tenant-memberships'] });
                },
                ...mutationErrCallback({ setError, popBanner }),
              }
            )
          )}
        >
          <FormControl w="form-width" isInvalid={!!errors.tenantId}>
            <FormLabel>Tenant</FormLabel>
            <SelectTenant name={'tenantId'} control={control} />
            <FormErrorMessage>{errors.tenantId?.message}</FormErrorMessage>
          </FormControl>
          <FormControl w="form-width" isInvalid={!!errors.userId}>
            <FormLabel>User</FormLabel>
            <SelectUser tenantId={undefined} name={'userId'} control={control} />
            <FormErrorMessage>{errors.userId?.message}</FormErrorMessage>
          </FormControl>
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
              onClick={() => navigate(parentPath)}
            >
              Cancel
            </Button>
          </ButtonGroup>
        </form>
      </Box>
    </PageTemplate>
  );
};
