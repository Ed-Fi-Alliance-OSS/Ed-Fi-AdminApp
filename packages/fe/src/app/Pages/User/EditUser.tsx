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
import { PutUserDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useNavigate, useParams } from '@tanstack/router';
import { useForm } from 'react-hook-form';
import { usePutUser, useUser, useUsers } from '../../api';
import { userIndexRoute, userRoute } from '../../routes/user.routes';

const resolver = classValidatorResolver(PutUserDto);

export const EditUser = () => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      from: userIndexRoute.fullPath,
      to: userIndexRoute.fullPath,
      params: (params) => params,
      search: {},
    });
  };
  const putUser = usePutUser(goToView);
  const userId: string = useParams({ from: userRoute.id }).userId;
  const user = useUser(userId).data;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutUserDto>({ resolver, defaultValues: { ...user } });

  return user ? (
    <form onSubmit={handleSubmit((data) => putUser.mutate(data))}>
      {/* TODO: replace this with real content */}
      <FormControl isInvalid={!!errors.givenName}>
        <FormLabel>Given Name</FormLabel>
        <Input {...register('givenName')} placeholder="givenName" />
        <FormErrorMessage>{errors.givenName?.message}</FormErrorMessage>
      </FormControl>
      <FormControl isInvalid={!!errors.familyName}>
        <FormLabel>Family Name</FormLabel>
        <Input {...register('familyName')} placeholder="familyName" />
        <FormErrorMessage>{errors.familyName?.message}</FormErrorMessage>
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
