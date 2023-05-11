import {
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  CheckboxGroup,
  Editable,
  EditableInput,
  EditablePreview,
  EditableTextarea,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Grid,
  HStack,
  IconButton,
  Input,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  PinInput,
  PinInputField,
  Radio,
  RadioGroup,
  RangeSlider,
  RangeSliderFilledTrack,
  RangeSliderThumb,
  RangeSliderTrack,
  Select,
  Slider,
  SliderFilledTrack,
  SliderMark,
  SliderThumb,
  SliderTrack,
  Stack,
  Switch,
  Textarea,
  Tooltip,
  VStack,
} from '@chakra-ui/react';
import { PutVendorDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { useForm } from 'react-hook-form';
import { vendorIndexRoute, vendorRoute } from '../../routes';
import { vendorQueries } from '../../api';

const resolver = classValidatorResolver(PutVendorDto);

export const EditVendor = () => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      to: vendorRoute.fullPath,
      params: (old: any) => old,
      search: {},
    });
  };
  const params = useParams({ from: vendorIndexRoute.id });
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
  const { edit } = useSearch({ from: vendorIndexRoute.id });
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutVendorDto>({ resolver, defaultValues: { ...vendor } });

  return vendor ? (
    <form onSubmit={handleSubmit((data) => putVendor.mutate(data))}>
      {/* TODO: replace this with real content */}
      <FormControl isInvalid={!!errors.company}>
        <FormLabel>Company</FormLabel>
        <Input {...register('company')} placeholder="company" />
        <FormErrorMessage>{errors.company?.message}</FormErrorMessage>
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
          type="submit"
          onClick={goToView}
        >
          Cancel
        </Button>
      </ButtonGroup>
    </form>
  ) : null;
};
