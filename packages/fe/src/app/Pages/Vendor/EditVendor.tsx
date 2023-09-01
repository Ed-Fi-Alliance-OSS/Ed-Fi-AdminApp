import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
} from '@chakra-ui/react';
import { PutVendorDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { vendorQueries } from '../../api';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';

const resolver = classValidatorResolver(PutVendorDto);

export const EditVendor = () => {
  const popBanner = usePopBanner();

  const navigate = useNavigate();
  const params = useParams() as {
    asId: string;
    sbeId: string;
    vendorId: string;
  };
  const goToView = () =>
    navigate(`/as/${params.asId}/sbes/${params.sbeId}/vendors/${params.vendorId}`);
  const putVendor = vendorQueries.usePut({
    callback: goToView,
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const vendor = vendorQueries.useOne({
    id: params.vendorId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const {
    register,
    setError,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PutVendorDto>({ resolver, defaultValues: { ...vendor } });

  return vendor ? (
    <form
      onSubmit={handleSubmit((data) =>
        putVendor.mutateAsync(data, mutationErrCallback({ popBanner, setError }))
      )}
    >
      {/* TODO add the rest of the form */}
      <FormControl isInvalid={!!errors.company}>
        <FormLabel>Company</FormLabel>
        <Input {...register('company')} placeholder="company" />
        <FormErrorMessage>{errors.company?.message}</FormErrorMessage>
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
          onClick={goToView}
        >
          Cancel
        </Button>
      </ButtonGroup>
    </form>
  ) : null;
};
