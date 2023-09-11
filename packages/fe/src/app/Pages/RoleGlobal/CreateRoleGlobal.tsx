import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Radio,
  RadioGroup,
  Stack,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { DependencyErrors, PostRoleDto, PrivilegeCode, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { privilegeQueries, roleQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { PrivilegesInput } from './PrivilegesInput';

const resolver = classValidatorResolver(PostRoleDto);

export const CreateRoleGlobalPage = () => {
  const popBanner = usePopBanner();
  const navigate = useNavigate();
  const parentPath = useNavToParent();
  const postRole = roleQueries.usePost({
    callback: (result) => navigate(`/roles/${result.id}`),
  });
  const privileges = privilegeQueries.useAll({});
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    control,
  } = useForm<PostRoleDto>({
    resolver,
    defaultValues: Object.assign(new PostRoleDto(), { privileges: ['me:read', 'privilege:read'] }),
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
    <PageTemplate title={'Create role'}>
      <form
        onSubmit={handleSubmit((data) => {
          return postRole.mutateAsync(data, mutationErrCallback({ popBanner, setError }));
        })}
      >
        <FormControl w="form-width" isInvalid={!!errors.name}>
          <FormLabel>Name</FormLabel>
          <Input {...register('name')} placeholder="name" />
          <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
        </FormControl>
        <FormControl w="form-width" isInvalid={!!errors.description}>
          <FormLabel>Description</FormLabel>
          <Input {...register('description')} placeholder="description" />
          <FormErrorMessage>{errors.description?.message}</FormErrorMessage>
        </FormControl>
        <FormControl w="form-width" isInvalid={!!errors.type}>
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
    </PageTemplate>
  );
};
