import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  chakra,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { PostApplicationForm } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useForm } from 'react-hook-form';
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
        onSubmit={handleSubmit((data) => {
          return postApplication.mutateAsync(data, {
            onSuccess(data, variables, context) {
              navigate(`/as/${asId}/sbes/${sbeId}/applications/${data.applicationId}`, {
                state: data.link,
              });
            },
            ...mutationErrCallback({ popBanner, setError }),
          });
        })}
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
        <FormControl isInvalid={!!errors.claimSetName}>
          <FormLabel>Claimset</FormLabel>
          <SelectClaimset
            useName
            tenantId={asId}
            name="claimSetName"
            sbeId={sbeId}
            control={control}
          />
          <FormErrorMessage>{errors.claimSetName?.message}</FormErrorMessage>
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
      </chakra.form>
    </PageTemplate>
  );
};
