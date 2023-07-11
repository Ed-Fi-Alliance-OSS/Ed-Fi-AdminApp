import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Text,
  Input,
} from '@chakra-ui/react';
import { PrivilegeCode, PutRoleDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { privilegeQueries, roleQueries } from '../../api';
import { PrivilegesInput } from './PrivilegesInput';

const resolver = classValidatorResolver(PutRoleDto);

export const EditRoleGlobal = () => {
  const navigate = useNavigate();
  const params = useParams() as {
    roleId: string;
  };
  const goToView = () => navigate(`/roles/${params.roleId}`);
  const putRole = roleQueries.usePut({
    callback: goToView,
  });
  const role = roleQueries.useOne({
    id: params.roleId,
  }).data;
  const privileges = privilegeQueries.useAll({});
  const filteredPrivileges =
    privileges.data && role
      ? Object.values(privileges.data).filter(
          (p) =>
            role.type === RoleType.UserGlobal ||
            (role.type === RoleType.ResourceOwnership && p.code.startsWith('tenant.sbe')) ||
            (role.type === RoleType.UserTenant && p.code.startsWith('tenant.'))
        )
      : undefined;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
    control,
  } = useForm<PutRoleDto>({
    resolver,
    defaultValues: { ...role, privileges: role?.privileges.map((p) => p.code) },
  });

  return role ? (
    <form onSubmit={handleSubmit((data) => putRole.mutate(data))}>
      <FormControl isInvalid={!!errors.description}>
        <FormLabel>Description</FormLabel>
        <Input {...register('description')} placeholder="description" />
        <FormErrorMessage>{errors.description?.message}</FormErrorMessage>
      </FormControl>
      <FormLabel as="p">Type</FormLabel>
      <Text>{role.type ?? '-'}</Text>
      <FormControl isInvalid={!!errors.privileges}>
        <FormLabel>Privileges</FormLabel>
        <Controller
          control={control}
          name="privileges"
          render={(field) =>
            filteredPrivileges === undefined ? (
              <></>
            ) : (
              <PrivilegesInput
                onChange={field.field.onChange}
                value={field.field.value as PrivilegeCode[]}
                privileges={filteredPrivileges}
              />
            )
          }
        />
        <FormErrorMessage>{errors.privileges?.message}</FormErrorMessage>
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
  ) : null;
};
