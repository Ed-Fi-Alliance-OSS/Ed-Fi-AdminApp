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
import { PutUserTenantMembershipDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { useForm } from 'react-hook-form';
import {
  userTenantMembershipRoute,
  userTenantMembershipIndexRoute,
} from '../../routes';
import { userTenantMembershipQueries } from '../../api';

const resolver = classValidatorResolver(PutUserTenantMembershipDto);

export const EditUserTenantMembership = () => {
  const navigate = useNavigate();
  const goToView = () => {
    navigate({
      to: userTenantMembershipRoute.fullPath,
      params: (old: any) => old,
      search: {},
    });
  };
  const params = useParams({ from: userTenantMembershipIndexRoute.id });
  const putUserTenantMembership = userTenantMembershipQueries.usePut({
    callback: goToView,
    tenantId: params.asId,
  });
  const userTenantMembership = userTenantMembershipQueries.useOne({
    id: params.userTenantMembershipId,
    tenantId: params.asId,
  }).data;
  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
  } = useForm<PutUserTenantMembershipDto>({
    resolver,
    defaultValues: { ...userTenantMembership },
  });

  return userTenantMembership ? (
    <form
      onSubmit={handleSubmit((data) => putUserTenantMembership.mutate(data))}
    >
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
