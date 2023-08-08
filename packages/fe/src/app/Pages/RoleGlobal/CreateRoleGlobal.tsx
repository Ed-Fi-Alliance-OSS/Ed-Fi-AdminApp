import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Text,
  Input,
  Box,
  Radio,
  RadioGroup,
  Stack,
} from '@chakra-ui/react';
import { PrivilegeCode, PostRoleDto, RoleType, DependencyErrors } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { privilegeQueries, roleQueries } from '../../api';
import { PrivilegesInput } from './PrivilegesInput';
import { useNavToParent } from '../../helpers';
import { PageTemplate } from '../PageTemplate';
import { useState } from 'react';

const resolver = classValidatorResolver(PostRoleDto);

export const CreateRoleGlobalPage = () => {
  const navigate = useNavigate();
  const parentPath = useNavToParent();
  const postRole = roleQueries.usePost({
    callback: (result) => navigate(`/roles/${result.id}`),
  });
  const privileges = privilegeQueries.useAll({});
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isLoading },
    control,
  } = useForm<PostRoleDto>({
    resolver,
  });
  const [type, setType] = useState<RoleType | null>(null);
  const filteredPrivileges =
    privileges.data && type
      ? Object.values(privileges.data).filter(
          (p) =>
            type === RoleType.UserGlobal ||
            (type === RoleType.ResourceOwnership && p.code.startsWith('tenant.sbe')) ||
            (type === RoleType.UserTenant && p.code.startsWith('tenant.'))
        )
      : undefined;
  let privilegesError: undefined | string | DependencyErrors = undefined;
  try {
    // might be fancy error object for privilege dependencies
    privilegesError = JSON.parse(errors.privileges?.message as string);
  } catch (error) {
    // either undefined or plain string from class-validator
  }

  return (
    <PageTemplate constrainWidth title={'Grant new resource ownership'} actions={undefined}>
      <Box>
        <form
          onSubmit={handleSubmit((data) => {
            postRole.mutate(data);
          })}
        >
          <FormControl isInvalid={!!errors.name}>
            <FormLabel>Name</FormLabel>
            <Input {...register('name')} placeholder="name" />
            <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.description}>
            <FormLabel>Description</FormLabel>
            <Input {...register('description')} placeholder="description" />
            <FormErrorMessage>{errors.description?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.type}>
            <FormLabel>Type</FormLabel>
            <Controller
              control={control}
              name="type"
              render={(field) => (
                <RadioGroup
                  {...field.field}
                  onChange={(value: RoleType) => {
                    field.field.onChange({ target: { value } });
                    setType(value);
                  }}
                >
                  <Stack direction="column" pl="1em" spacing={1}>
                    <Radio value={RoleType.UserTenant}>User tenant</Radio>
                    <Radio value={RoleType.UserGlobal}>User global</Radio>
                    <Radio value={RoleType.ResourceOwnership}>Resource ownership</Radio>
                  </Stack>
                </RadioGroup>
              )}
            />
            <FormErrorMessage>{errors.type?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={typeof privilegesError === 'string'}>
            <FormLabel>Privileges</FormLabel>
            <Controller
              control={control}
              name="privileges"
              render={(field) =>
                filteredPrivileges === undefined ? (
                  <></>
                ) : (
                  <PrivilegesInput
                    error={typeof privilegesError === 'string' ? undefined : privilegesError}
                    onChange={field.field.onChange}
                    value={field.field.value as PrivilegeCode[]}
                    privileges={filteredPrivileges}
                  />
                )
              }
            />
            <FormErrorMessage>
              {typeof privilegesError === 'string' ? privilegesError : undefined}
            </FormErrorMessage>
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
