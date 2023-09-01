import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { GetApplicationDto, PutApplicationForm } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { applicationQueries, claimsetQueries, edorgQueries } from '../../api';
import { useNavContext } from '../../helpers';
import { SelectClaimset, SelectEdorg, SelectVendor } from '../../helpers/FormPickers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { usePopBanner } from '../../Layout/FeedbackBanner';

const resolver = classValidatorResolver(PutApplicationForm);

export const EditApplication = (props: { application: GetApplicationDto }) => {
  const { application } = props;
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;

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
  defaultValues.claimSetName = application.claimSetName;
  defaultValues.educationOrganizationId = application.educationOrganizationId;
  defaultValues.vendorId = application.vendorId;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    formState,
    control,
    watch,
    getValues,
    setError,
  } = useForm<PutApplicationForm>({
    resolver,
    defaultValues,
  });
  return edorgs.data && claimsets.data ? (
    <form
      onSubmit={handleSubmit((data) => {
        return putApplication.mutateAsync(data, mutationErrCallback({ popBanner, setError }));
      })}
    >
      <Box width="20em">
        <FormControl isInvalid={!!errors.applicationName}>
          <FormLabel>Application name</FormLabel>
          <Input {...register('applicationName')} placeholder="name" />
          <FormErrorMessage>{errors.applicationName?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.educationOrganizationId}>
          <FormLabel>Ed-org</FormLabel>
          <SelectEdorg
            tenantId={asId}
            name="educationOrganizationId"
            useEdorgId
            sbeId={sbeId}
            control={control}
          />
          <FormErrorMessage>{errors.educationOrganizationId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.vendorId}>
          <FormLabel>Vendor</FormLabel>
          <SelectVendor tenantId={asId} name="vendorId" sbeId={sbeId} control={control} />
          <FormErrorMessage>{errors.vendorId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.claimSetName}>
          <FormLabel>Claimset</FormLabel>
          <SelectClaimset
            useName
            tenantId={asId}
            name="claimSetName"
            sbeId={sbeId}
            control={control}
          />
          <FormErrorMessage>{errors.claimSetName?.message}</FormErrorMessage>
        </FormControl>
        <ButtonGroup mt={4} colorScheme="teal">
          <Button isLoading={isSubmitting} type="submit">
            Save
          </Button>
          <Button variant="ghost" isLoading={isSubmitting} type="reset" onClick={goToView}>
            Cancel
          </Button>
        </ButtonGroup>
      </Box>
    </form>
  ) : null;
};
