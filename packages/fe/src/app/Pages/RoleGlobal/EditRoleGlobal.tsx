import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Text,
} from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import {
  DependencyErrors,
  GetRoleDto,
  PrivilegeCode,
  PutRoleDto,
  RoleType,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { privilegeQueries, roleQueries } from '../../api';
import { PrivilegesInput } from './PrivilegesInput';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import uniq from 'lodash/uniq';

const resolver = classValidatorResolver(PutRoleDto);
const hasTenantImpersonation = (form: PutRoleDto) =>
  form.privileges?.some((p) => p.startsWith('tenant.'));

const hasGlobalPrivileges = (form: PutRoleDto) =>
  form.privileges?.some(
    (p) => p !== 'me:read' && p !== 'privilege:read' && !p.startsWith('tenant.')
  );

const hasNewTenantImpersonation = (form: PutRoleDto, existing: GetRoleDto) =>
  existing.type === RoleType.UserGlobal &&
  hasTenantImpersonation(form) &&
  !hasTenantImpersonation({ ...existing, privileges: existing.privileges.map((p) => p.code) });

const hasNewGlobalPrivileges = (form: PutRoleDto, existing: GetRoleDto) =>
  existing.type === RoleType.UserGlobal &&
  hasGlobalPrivileges(form) &&
  !hasGlobalPrivileges({ ...existing, privileges: existing.privileges.map((p) => p.code) });

export const EditRoleGlobal = (props: { role: GetRoleDto }) => {
  const popBanner = usePopBanner();

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
    watch,
    setError,
    formState: { errors, isSubmitting },
    control,
  } = useForm<PutRoleDto>({
    resolver,
    defaultValues: {
      ...role,
      privileges: uniq([
        ...(role?.privileges.map((p) => p.code) ?? []),
        'me:read',
        'privilege:read',
      ]),
    },
  });

  let privilegesError: undefined | string | DependencyErrors = undefined;
  try {
    // might be fancy error object for privilege dependencies
    privilegesError = JSON.parse(errors.privileges?.message as string);
  } catch (error) {
    // either undefined or plain string from class-validator
  }
  const allValues = watch();

  const tenantImpersonation = hasNewTenantImpersonation(allValues, props.role);
  const adminPrivileges = hasNewGlobalPrivileges(allValues, props.role);
  const confirmBody = tenantImpersonation
    ? adminPrivileges
      ? "It looks like you're adding some new global privileges that this role didn't used to have. Are you sure you want to do that?"
      : "It looks like you're adding at least some pieces of tenant impersonation ability to this role. Are you sure you want to do that?"
    : adminPrivileges
    ? "It looks like you're adding some global privileges that this role didn't used to have. Are you sure you want to do that?"
    : null;

  const formRef = useRef<HTMLFormElement>(null);
  return role ? (
    <form
      ref={formRef}
      onSubmit={handleSubmit((data) =>
        putRole.mutateAsync(data, mutationErrCallback({ popBanner, setError }))
      )}
    >
      <FormControl maxW="form-width" isInvalid={!!errors.description}>
        <FormLabel>Description</FormLabel>
        <Input {...register('description')} placeholder="description" />
        <FormErrorMessage>{errors.description?.message}</FormErrorMessage>
      </FormControl>
      <FormLabel as="p">Type</FormLabel>
      <Text>{role.type ?? '-'}</Text>
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
        <ConfirmAction
          action={() => {
            formRef.current?.dispatchEvent(
              new Event('submit', { bubbles: true, cancelable: true })
            );
          }}
          skipConfirmation={confirmBody === null}
          headerText="Add new admin privileges?"
          bodyText={confirmBody ?? ''}
          yesButtonText="Yes, save"
          noButtonText="No, cancel"
        >
          {(props) => (
            <Button
              mt={4}
              colorScheme="teal"
              isLoading={isSubmitting}
              type="submit"
              onClick={(e) => {
                e.preventDefault();
                props.onClick && props.onClick(e);
              }}
            >
              Save
            </Button>
          )}
        </ConfirmAction>
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
    </form>
  ) : null;
};
