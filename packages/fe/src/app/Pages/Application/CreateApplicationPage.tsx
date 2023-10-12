import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Icon,
  Input,
  Text,
  Tooltip,
  chakra,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostApplicationForm } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { noop } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { BsInfoCircle } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useApplicationPost } from '../../api';
import { useNavContext, useNavToParent } from '../../helpers';
import { SelectClaimset, SelectEdorg, SelectVendor } from '../../helpers/FormPickers';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
const resolver = classValidatorResolver(PostApplicationForm);

export const CreateApplicationPage = () => {
  const navigate = useNavigate();
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;
  const navToParentOptions = useNavToParent();
  const popBanner = usePopBanner();

  const postApplication = useApplicationPost({
    sbeId: sbeId,
    tenantId: asId,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    control,
  } = useForm<PostApplicationForm>({
    resolver,
    defaultValues: new PostApplicationForm(),
  });

  return (
    <PageTemplate title="New application">
      <chakra.form
        w="form-width"
        onSubmit={handleSubmit((data) =>
          postApplication
            .mutateAsync(data, {
              onSuccess(data, variables, context) {
                navigate(`/as/${asId}/sbes/${sbeId}/applications/${data.applicationId}`, {
                  state: data.link,
                });
              },
              ...mutationErrCallback({ popGlobalBanner: popBanner, setFormError: setError }),
            })
            .catch(noop)
        )}
      >
        <FormControl isInvalid={!!errors.applicationName}>
          <FormLabel>Application name</FormLabel>
          <Input {...register('applicationName')} placeholder="name" />
          <FormErrorMessage>{errors.applicationName?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.educationOrganizationId}>
          <FormLabel>Ed-org</FormLabel>
          <SelectEdorg
            tenantId={asId}
            name="educationOrganizationId"
            useEdorgId
            sbeId={sbeId}
            control={control}
          />
          <FormErrorMessage>{errors.educationOrganizationId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.vendorId}>
          <FormLabel>Vendor</FormLabel>
          <SelectVendor tenantId={asId} name="vendorId" sbeId={sbeId} control={control} />
          <FormErrorMessage>{errors.vendorId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.claimsetId}>
          <FormLabel>
            Claimset{' '}
            <Tooltip label="You can only select non-reserved claimsets here." hasArrow>
              <chakra.span>
                <Icon as={BsInfoCircle} />
              </chakra.span>
            </Tooltip>
          </FormLabel>
          <SelectClaimset
            noReserved
            tenantId={asId}
            name="claimsetId"
            sbeId={sbeId}
            control={control}
          />
          <FormErrorMessage>{errors.claimsetId?.message}</FormErrorMessage>
        </FormControl>
        <ButtonGroup mt={4} colorScheme="teal">
          <Button isLoading={isSubmitting} type="submit">
            Save
          </Button>
          <Button
            variant="ghost"
            isLoading={isSubmitting}
            type="reset"
            onClick={() => {
              navigate(navToParentOptions);
            }}
          >
            Cancel
          </Button>
        </ButtonGroup>
        {errors.root?.message ? (
          <Text mt={4} color="red.500">
            {errors.root?.message}
          </Text>
        ) : null}
      </chakra.form>
    </PageTemplate>
  );
};
