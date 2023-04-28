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
import { PutOwnershipDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useNavigate, useParams } from '@tanstack/router';
import { useForm } from 'react-hook-form';
import { usePutOwnership, useOwnership } from '../../api';
import { ownershipRoute } from '../../routes';

const resolver = classValidatorResolver(PutOwnershipDto);

export const EditOwnership = () => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      to: ownershipRoute.fullPath,
      params: (old: any) => old,
      search: {},
    });
  };
  const putOwnership = usePutOwnership(goToView);
  const params = useParams({ from: ownershipRoute.id });
  const ownership = useOwnership(params.ownershipId).data;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutOwnershipDto>({ resolver, defaultValues: { ...ownership } });

  return ownership ? (
    <form onSubmit={handleSubmit((data) => putOwnership.mutate(data))}>
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
