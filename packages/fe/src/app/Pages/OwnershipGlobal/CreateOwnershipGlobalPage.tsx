import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostOwnershipDto, RoleType } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { plainToInstance } from 'class-transformer';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ownershipQueries, sbeQueries, tenantQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import {
  SelectEdorg,
  SelectOds,
  SelectRole,
  SelectSbe,
  SelectTenant,
} from '../../helpers/FormPickers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { usePopBanner } from '../../Layout/FeedbackBanner';

const resolver = classValidatorResolver(PostOwnershipDto);

const getDefaults = (dict: {
  sbeId?: string;
  tenantId?: string;
  type?: 'ods' | 'edorg' | 'sbe';
}) => {
  return {
    sbeId: 'sbeId' in dict ? Number(dict.sbeId) : undefined,
    tenantId: 'tenantId' in dict ? Number(dict.tenantId) : undefined,
    type: 'type' in dict ? dict.type : 'ods',
  };
};

export const CreateOwnershipGlobalPage = () => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();
  const goToView = (id: string | number) => navigate(`/ownerships/${id}`);

  const tenants = tenantQueries.useAll({});
  const sbes = sbeQueries.useAll({});

  const search = useSearchParamsObject(getDefaults);
  const ownershipFormDefaults: Partial<PostOwnershipDto> = Object.assign(
    new PostOwnershipDto(),
    search
  );
  const popBanner = usePopBanner();

  const postOwnership = ownershipQueries.usePost({
    callback: (result) => {
      goToView(result.id);
    },
  });
  const {
    handleSubmit,
    formState: { errors, isSubmitting },
    control,
    setValue,
    watch,
    setError,
  } = useForm({
    resolver,
    defaultValues: ownershipFormDefaults,
  });

  const [sbeId, type] = watch(['sbeId', 'type']);

  return tenants.data && sbes.data ? (
    <PageTemplate title={'Grant new resource ownership'} actions={undefined}>
      <Box maxW="30em">
        <FormLabel>Resource type</FormLabel>
        <RadioGroup
          onChange={(value: any) => {
            setValue('type', value);
            setValue('edorgId', undefined);
            setValue('odsId', undefined);
          }}
          value={type}
        >
          <Stack direction="column" pl="1em" spacing={1}>
            <Radio value="edorg">Ed-Org</Radio>
            <Radio value="ods">Ods</Radio>
            <Radio value="sbe">Whole environment</Radio>
          </Stack>
        </RadioGroup>
        <form
          onSubmit={handleSubmit((data) => {
            const body = plainToInstance(PostOwnershipDto, data);
            if (type !== 'sbe') {
              body.sbeId = undefined;
            }
            return postOwnership.mutateAsync(body, mutationErrCallback({ setError, popBanner }));
          })}
        >
          <FormControl isInvalid={!!errors.hasResource && (sbeId === undefined || type === 'sbe')}>
            <FormLabel>Starting Blocks environment</FormLabel>
            <SelectSbe name="sbeId" control={control} tenantId={undefined} />
            <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
          </FormControl>
          {type === 'ods' && sbeId !== undefined ? (
            <FormControl isDisabled={sbeId === undefined} isInvalid={!!errors.hasResource}>
              <FormLabel>ODS</FormLabel>
              <SelectOds
                sbeId={sbeId}
                control={control}
                name="odsId"
                useDbName={false}
                tenantId={undefined}
              />
              <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
            </FormControl>
          ) : null}
          {type === 'edorg' && sbeId !== undefined ? (
            <FormControl isDisabled={sbeId === undefined} isInvalid={!!errors.hasResource}>
              <FormLabel>Ed-Org</FormLabel>
              <SelectEdorg
                sbeId={sbeId}
                control={control}
                name="edorgId"
                useEdorgId={false}
                tenantId={undefined}
              />
              <FormErrorMessage>{errors.hasResource?.message}</FormErrorMessage>
            </FormControl>
          ) : null}
          <FormControl isInvalid={!!errors.tenantId}>
            <FormLabel>Tenant</FormLabel>
            <SelectTenant name="tenantId" control={control} />
            <FormErrorMessage>{errors.tenantId?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.roleId}>
            <FormLabel>Role</FormLabel>
            <SelectRole
              name="roleId"
              types={[RoleType.ResourceOwnership]}
              control={control}
              tenantId={undefined}
            />
            <FormErrorMessage>{errors.roleId?.message}</FormErrorMessage>
          </FormControl>
          <ButtonGroup mt={4} colorScheme="teal">
            <Button isLoading={isSubmitting} type="submit">
              Save
            </Button>
            <Button
              variant="ghost"
              isLoading={isSubmitting}
              type="reset"
              onClick={() => {
                navigate(navToParentOptions);
              }}
            >
              Cancel
            </Button>
          </ButtonGroup>
        </form>
      </Box>
    </PageTemplate>
  ) : null;
};
