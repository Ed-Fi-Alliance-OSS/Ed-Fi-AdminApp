import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Stack,
  Text,
  Radio,
  RadioGroup,
  Switch,
  Tooltip,
  chakra,
} from '@chakra-ui/react';
import { Icons, PageTemplate } from '@edanalytics/common-ui';
import { PostSbEnvironmentDto } from '@edanalytics/models';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { sbEnvironmentQueries } from '../../api';
import { popSyncBanner, useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { useState } from 'react';

export const CreateSbEnvironmentGlobalPage = () => {
  const [isStartingBlocks, setStartingBlocks] = useState(false);
  const popBanner = usePopBanner();
  const navToParentOptions = useNavToParent();
  const navigate = useNavigate();
  const postSbEnvironment = sbEnvironmentQueries.post({});
  const {
    register,
    setError,
    handleSubmit,
    clearErrors,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PostSbEnvironmentDto>({
    defaultValues: Object.assign(new PostSbEnvironmentDto(), { metaArn: undefined, version: 'v1' }),
  });

  // Watch the version value for the RadioGroup
  const currentVersion = watch('version');

  const handleSwitchChange = (checked: boolean) => {
    setStartingBlocks(checked);

    // Clear validation errors when switching modes to prevent stale errors
    clearErrors(['metaArn', 'odsApiDiscoveryUrl', 'adminApiUrl', 'version', 'environmentLabel']);

    // Clear field values when switching modes to prevent stale data
    if (checked) {
      setValue('odsApiDiscoveryUrl', undefined);
      setValue('adminApiUrl', undefined);
      setValue('version', undefined);
      setValue('environmentLabel', undefined);
      setValue('edOrgIds', '');
      setValue('isMultitenant', false);
    } else {
      setValue('metaArn', undefined);
      setValue('version', 'v1');
    }
  };

  const handleVersionChange = (value: string) => {
    setValue('version', value as 'v1' | 'v2');
  };

  // Manual validation function
  const validateForm = (data: PostSbEnvironmentDto): boolean => {
    let isValid = true;

    // Clear previous errors
    clearErrors();

    // Always validate name
    if (!data.name || data.name.trim() === '') {
      setError('name', { message: 'Name is required' });
      isValid = false;
    }

    if (isStartingBlocks) {
      // Validate Starting Blocks fields
      if (!data.metaArn || data.metaArn.trim() === '') {
        setError('metaArn', { message: 'Metadata ARN is required' });
        isValid = false;
      }
    } else {
      // Validate manual configuration fields
      if (!data.version || data.version.trim() === '') {
        setError('version', { message: 'Version is required' });
        isValid = false;
      }
      if (!data.odsApiDiscoveryUrl || data.odsApiDiscoveryUrl.trim() === '') {
        setError('odsApiDiscoveryUrl', { message: 'Ed-Fi API Discovery URL is required' });
        isValid = false;
      }
      if (!data.adminApiUrl || data.adminApiUrl.trim() === '') {
        setError('adminApiUrl', { message: 'Management API Discovery URL is required' });
        isValid = false;
      }
      if (!data.environmentLabel || data.environmentLabel.trim() === '') {
        setError('environmentLabel', { message: 'Environment Label is required' });
        isValid = false;
      }
    }

    return isValid;
  };

  const onSubmit = (data: PostSbEnvironmentDto) => {
    // Manual validation
    if (!validateForm(data)) {
      return;
    }

    return postSbEnvironment
      .mutateAsync(
        { entity: data },
        {
          onSuccess: (result) => {
            navigate(`/sb-environments/${result.id}`);
            result.syncQueue &&
              popSyncBanner({
                popBanner,
                syncQueue: result.syncQueue,
              });
          },
          ...mutationErrCallback({ setFormError: setError, popGlobalBanner: popBanner }),
        }
      )
      .catch((error) => {
        console.error('Error creating environment:', error);
      });
  };

  return (
    <PageTemplate constrainWidth title={'Connect new environment'} actions={undefined}>
      <Box w="form-width">
        <form onSubmit={handleSubmit(onSubmit)}>
          <FormControl>
            <FormLabel>
              Using Starting Blocks from Education Analytics?{' '}
              <Tooltip
                label="Toggle this switch when you you are using Starting Blocks for your Ed-Fi deployment."
                hasArrow
              >
                <chakra.span>
                  <Icons.InfoCircle />
                </chakra.span>
              </Tooltip>
            </FormLabel>
            <Switch
              size="md"
              colorScheme="primary"
              mb="0"
              {...register('startingBlocks')}
              onChange={(e) => handleSwitchChange(e.target.checked)}
            />
          </FormControl>

          <FormControl isInvalid={!!errors.name}>
            <FormLabel>
              Name{' '}
              <Tooltip label="Provide a unique name for the environment" hasArrow>
                <chakra.span>
                  <Icons.InfoCircle />
                </chakra.span>
              </Tooltip>
            </FormLabel>
            <Input {...register('name')} placeholder="name" />
            <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
          </FormControl>

          {isStartingBlocks ? (
            <FormControl isInvalid={!!errors.metaArn}>
              <FormLabel>Metadata ARN</FormLabel>
              <Input {...register('metaArn')} placeholder="arn:aws:lambda:us..." />
              <FormErrorMessage>{errors.metaArn?.message}</FormErrorMessage>
            </FormControl>
          ) : null}

          {!isStartingBlocks ? (
            <Box>
              <FormControl isInvalid={!!errors.odsApiDiscoveryUrl}>
                <FormLabel>
                  Ed-Fi API Discovery URL{' '}
                  <Tooltip label="The base URL for the ODS/API or DMS" hasArrow>
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Input {...register('odsApiDiscoveryUrl')} placeholder="https://..." />
                <FormErrorMessage>{errors.odsApiDiscoveryUrl?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.adminApiUrl}>
                <FormLabel>
                  Management API Discovery URL{' '}
                  <Tooltip label="The base URL for Admin API or DMS Configuration Service" hasArrow>
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Input {...register('adminApiUrl')} placeholder="https://..." />
                <FormErrorMessage>{errors.adminApiUrl?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.version}>
                <FormLabel>Management API Version</FormLabel>
                <RadioGroup onChange={handleVersionChange} value={currentVersion} colorScheme="primary">
                  <Stack direction="row">
                    <Radio value="v1" {...register('version')}>
                      v1
                    </Radio>
                    <Radio value="v2" {...register('version')}>
                      v2
                    </Radio>
                  </Stack>
                </RadioGroup>
                <FormErrorMessage>{errors.version?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.environmentLabel}>
                <FormLabel>
                  Environment Label{' '}
                  <Tooltip label="Examples: Development, Staging, Production" hasArrow>
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Input {...register('environmentLabel')} placeholder="production" />
                <FormErrorMessage>{errors.environmentLabel?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.edOrgIds}>
                <FormLabel>
                  Education Organization Identifier(s){' '}
                  <Tooltip
                    label="Comma separated list of Education Organization IDs managed in this instance"
                    hasArrow
                  >
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Input {...register('edOrgIds')} placeholder="1, 255901, 25590100" />
                <FormErrorMessage>{errors.edOrgIds?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!errors.isMultitenant}>
                <FormLabel>
                  Is this a multi-tenant deployment?{' '}
                  <Tooltip label="Not applicable with ODS/API 6.x" hasArrow>
                    <chakra.span>
                      <Icons.InfoCircle />
                    </chakra.span>
                  </Tooltip>
                </FormLabel>
                <Switch size="md" colorScheme="primary" mb="0" {...register('isMultitenant')} />
                <FormErrorMessage>{errors.isMultitenant?.message}</FormErrorMessage>
              </FormControl>
            </Box>
          ) : null}
          <ButtonGroup mt={4} colorScheme="primary">
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
          {errors.root?.message ? (
            <Text mt={4} color="red.500">
              {errors.root?.message}
            </Text>
          ) : null}
        </form>
      </Box>
    </PageTemplate>
  );
};
