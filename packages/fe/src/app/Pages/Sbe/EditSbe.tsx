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
import { PutSbeDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useNavigate, useParams } from '@tanstack/router';
import { useForm } from 'react-hook-form';
import { usePutSbe, useSbe } from '../../api';
import { sbeIndexRoute, sbeRoute } from '../../routes/sbe.routes';

const resolver = classValidatorResolver(PutSbeDto);

export const EditSbe = () => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      to: sbeIndexRoute.fullPath,
      params: { sbeId },
      search: {},
    });
  };
  const putSbe = usePutSbe(goToView);
  const sbeId: string = useParams({ from: sbeRoute.id }).sbeId;
  const sbe = useSbe(sbeId).data;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutSbeDto>({ resolver, defaultValues: { ...sbe } });

  return sbe ? (
    <form onSubmit={handleSubmit((data) => putSbe.mutate(data))}>
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
