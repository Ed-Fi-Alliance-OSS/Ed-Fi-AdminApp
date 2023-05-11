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
import { PutApplicationDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { useForm } from 'react-hook-form';
import { applicationIndexRoute, applicationRoute } from '../../routes';
import { applicationQueries } from '../../api';

const resolver = classValidatorResolver(PutApplicationDto);

export const EditApplication = () => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      to: applicationRoute.fullPath,
      params: (old: any) => old,
      search: {},
    });
  };
  const params = useParams({ from: applicationIndexRoute.id });
  const putApplication = applicationQueries.usePut({
    callback: goToView,
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const application = applicationQueries.useOne({
    id: params.applicationId,
    sbeId: params.sbeId,
    tenantId: params.asId,
  }).data;
  const { edit } = useSearch({ from: applicationIndexRoute.id });
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutApplicationDto>({
    resolver,
    defaultValues: { ...application },
  });

  return application ? (
    <form onSubmit={handleSubmit((data) => putApplication.mutate(data))}>
      {/* TODO: replace this with real content */}
      <FormControl isInvalid={!!errors.applicationName}>
        <FormLabel>Application name</FormLabel>
        <Input {...register('applicationName')} placeholder="applicationName" />
        <FormErrorMessage>{errors.applicationName?.message}</FormErrorMessage>
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
