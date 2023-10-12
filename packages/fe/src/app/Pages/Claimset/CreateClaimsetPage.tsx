import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  Input,
  Text,
  Textarea,
  Tooltip,
  chakra,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostClaimsetDto } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useQueryClient } from '@tanstack/react-query';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { BsInfoCircle } from 'react-icons/bs';
import { useNavigate, useParams } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { claimsetQueries } from '../../api';
import { useNavToParent } from '../../helpers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
import { flattenFieldErrors } from '@edanalytics/utils';

const resolver = classValidatorResolver(PostClaimsetDto);

export const CreateClaimset = () => {
  const params = useParams() as { asId: string; sbeId: string };
  const popBanner = usePopBanner();

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const goToView = (id: string | number) =>
    navigate(`/as/${params.asId}/sbes/${params.sbeId}/claimsets/${id}`);
  const parentPath = useNavToParent();
  const postClaimset = claimsetQueries.usePost({
    sbeId: params.sbeId,
    tenantId: params.asId,
    callback: (result) => goToView(result.id),
  });
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PostClaimsetDto>({
    resolver,
    defaultValues: Object.assign(new PostClaimsetDto(), {}),
  });

  return (
    <PageTemplate constrainWidth title={'Create new claimset'} actions={undefined}>
      <form
        onSubmit={handleSubmit((data) =>
          postClaimset
            .mutateAsync(data, {
              ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['me', 'claimsets'] });
              },
            })
            .catch(noop)
        )}
      >
        <FormControl w="form-width" isInvalid={!!errors.name}>
          <FormLabel>Name</FormLabel>
          <Input {...register('name')} />
          <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
        </FormControl>
        <FormControl w="90%" isInvalid={!!errors.resourceClaims}>
          <FormLabel>
            Resource claims{' '}
            <Tooltip label="Paste resource claims JSON here." hasArrow>
              <chakra.span>
                <Icon as={BsInfoCircle} />
              </chakra.span>
            </Tooltip>
          </FormLabel>
          <Textarea
            fontFamily="mono"
            minH="20em"
            {...register('resourceClaimsJson')}
            css={{
              '&::placeholder': {
                whiteSpace: 'pre',
              },
            }}
            placeholder='[&#10;  {&#10;    "name": "types",&#10;    "read": true,&#10;    "create": true,&#10;    "update": true,&#10;    "delete": true,&#10;    "defaultAuthStrategiesForCRUD": ...'
          />
          <FormErrorMessage>{flattenFieldErrors(errors, 'resourceClaims')}</FormErrorMessage>
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
            onClick={() => navigate(parentPath)}
          >
            Cancel
          </Button>
        </ButtonGroup>
        {errors.root?.message ? (
          <Text mt={4} color="red.500">
            {errors.root?.message}
          </Text>
        ) : null}
      </form>
    </PageTemplate>
  );
};
