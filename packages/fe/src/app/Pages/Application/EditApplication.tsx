import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  Input,
  Text,
  Tooltip,
  chakra,
} from '@chakra-ui/react';
import { GetApplicationDto, GetClaimsetDto, PutApplicationForm } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { BsInfoCircle } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { applicationQueries, claimsetQueries, edorgQueries, queryKey } from '../../api';
import { useNavContext } from '../../helpers';
import { SelectClaimset, SelectEdorg, SelectVendor } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutApplicationForm);

export const EditApplication = (props: {
  application: GetApplicationDto;
  claimset: GetClaimsetDto;
}) => {
  const { application, claimset } = props;
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;
  const queryClient = useQueryClient();
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const goToView = () => {
    navigate(`/as/${asId}/sbes/${sbeId}/applications/${application.id}`);
  };
  const edorgs = edorgQueries.useAll({
    sbeId: sbeId,
    tenantId: asId,
  });

  const claimsets = claimsetQueries.useAll({
    sbeId: sbeId,
    tenantId: asId,
  });

  const putApplication = applicationQueries.usePut({
    sbeId: sbeId,
    tenantId: asId,
    callback: goToView,
  });
  const defaultValues = new PutApplicationForm();
  defaultValues.applicationId = application.applicationId;
  defaultValues.applicationName = application.displayName;
  defaultValues.claimsetId = claimset.id;
  defaultValues.educationOrganizationId = application.educationOrganizationId;
  defaultValues.vendorId = application.vendorId;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formState,
    control,
    setError,
  } = useForm<PutApplicationForm>({
    resolver,
    defaultValues,
  });
  return edorgs.data && claimsets.data ? (
    <form
      onSubmit={handleSubmit((data) =>
        putApplication
          .mutateAsync(data, {
            onSuccess() {
              queryClient.invalidateQueries({
                queryKey: queryKey({
                  resourceName: 'Claimset',
                  tenantId: asId,
                  sbeId: sbeId,
                }),
              });
            },
            ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
          })
          .catch(noop)
      )}
    >
      <Box width="30em">
        <FormControl isInvalid={!!errors.applicationName}>
          <FormLabel>Application name</FormLabel>
          <Input {...register('applicationName')} placeholder="name" />
          <FormErrorMessage>{errors.applicationName?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.educationOrganizationId}>
          <FormLabel>Ed-org</FormLabel>
          <SelectEdorg name="educationOrganizationId" useEdorgId control={control} />
          <FormErrorMessage>{errors.educationOrganizationId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.vendorId}>
          <FormLabel>Vendor</FormLabel>
          <SelectVendor name="vendorId" control={control} />
          <FormErrorMessage>{errors.vendorId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.claimsetId}>
          <FormLabel>
            Claimset{' '}
            <Tooltip label="You can only select non-reserved claimsets here." hasArrow>
              <chakra.span>
                <Icon as={BsInfoCircle} />
              </chakra.span>
            </Tooltip>
          </FormLabel>
          <SelectClaimset noReserved name="claimsetId" control={control} />
          <FormErrorMessage>{errors.claimsetId?.message}</FormErrorMessage>
        </FormControl>
        <ButtonGroup mt={4} colorScheme="teal">
          <Button isLoading={isSubmitting} type="submit">
            Save
          </Button>
          <Button variant="ghost" isLoading={isSubmitting} type="reset" onClick={goToView}>
            Cancel
          </Button>
        </ButtonGroup>
        {errors.root?.message ? (
          <Text mt={4} color="red.500">
            {errors.root?.message}
          </Text>
        ) : null}
      </Box>
    </form>
  ) : null;
};
