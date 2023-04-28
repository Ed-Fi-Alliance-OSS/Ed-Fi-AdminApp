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
import { PutEdorgDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useNavigate, useParams } from '@tanstack/router';
import { useForm } from 'react-hook-form';
import { usePutEdorg, useEdorg } from '../../api';
import { edorgRoute } from '../../routes';

const resolver = classValidatorResolver(PutEdorgDto);

export const EditEdorg = () => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      to: edorgRoute.fullPath,
      params: (old: any) => old,
      search: {},
    });
  };
  const putEdorg = usePutEdorg(goToView);
  const params = useParams({ from: edorgRoute.id });
  const edorg = useEdorg(params.edorgId, params.sbeId).data;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutEdorgDto>({ resolver, defaultValues: { ...edorg } });

  return edorg ? (
    <form onSubmit={handleSubmit((data) => putEdorg.mutate(data))}>
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
