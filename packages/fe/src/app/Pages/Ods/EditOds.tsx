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
import { PutOdsDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useNavigate, useParams } from '@tanstack/router';
import { useForm } from 'react-hook-form';
import { usePutOds, useOds } from '../../api';
import { odsRoute } from '../../routes';

const resolver = classValidatorResolver(PutOdsDto);

export const EditOds = () => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      to: odsRoute.fullPath,
      params: (old: any) => old,
      search: {},
    });
  };
  const putOds = usePutOds(goToView);
  const params = useParams({ from: odsRoute.id });
  const ods = useOds(params.odsId, params.sbeId).data;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutOdsDto>({ resolver, defaultValues: { ...ods } });

  return ods ? (
    <form onSubmit={handleSubmit((data) => putOds.mutate(data))}>
      {/* TODO: replace this with real content */}
      <FormControl isInvalid={!!errors.id}>
        <FormLabel>Id</FormLabel>
        <Input {...register('id')} placeholder="id" />
        <FormErrorMessage>{errors.id?.message}</FormErrorMessage>
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
