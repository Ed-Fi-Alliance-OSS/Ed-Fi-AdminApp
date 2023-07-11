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
import { PrivilegeCode, PostRoleDto, RoleType } from '@edanalytics/models';
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
    formState: { errors, isLoading },
    control,
  } = useForm<PostRoleDto>({
    resolver,
    defaultValues: {},
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

  return (
    <PageTemplate constrainWidth title={'Grant new resource ownership'} actions={undefined}>
      <Box w="20em">
        <form onSubmit={handleSubmit((data) => postRole.mutate(data))}>
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
            <RadioGroup
              {...register('type')}
              onChange={(value) => {
                setType(value as any);
                setValue('type', value as any);
              }}
            >
              <Stack direction="column" pl="1em" spacing={1}>
                <Radio value={RoleType.UserTenant}>User tenant</Radio>
                <Radio value={RoleType.UserGlobal}>User global</Radio>
                <Radio value={RoleType.ResourceOwnership}>Resource ownership</Radio>
              </Stack>
            </RadioGroup>

            <FormErrorMessage>{errors.type?.message}</FormErrorMessage>
          </FormControl>
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
