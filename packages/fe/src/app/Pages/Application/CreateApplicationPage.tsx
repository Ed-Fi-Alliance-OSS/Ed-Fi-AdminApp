import {
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  useClipboard,
} from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { ApplicationYopassResponseDto, PostApplicationForm } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useApplicationPost } from '../../api';
import { useNavContext, useNavToParent } from '../../helpers';
import { SelectClaimset, SelectEdorg, SelectVendor } from '../../helpers/FormPickers';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { mutationErrCallback } from '../../helpers/mutationErrCallback';
const resolver = classValidatorResolver(PostApplicationForm);

export const CreateApplicationPage = () => {
  const navigate = useNavigate();
  const navContext = useNavContext();
  const sbeId = navContext.sbeId!;
  const asId = navContext.asId!;
  const navToParentOptions = useNavToParent();
  const popBanner = usePopBanner();

  const [result, setResult] = useState<ApplicationYopassResponseDto | null>(null);
  const clipboard = useClipboard('');

  const postApplication = useApplicationPost({
    sbeId: sbeId,
    tenantId: asId,
    callback: (result) => {
      setResult(result);
      clipboard.setValue(result.link);
    },
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
    <PageTemplate title="New application" constrainWidth>
      <Modal
        isOpen={!!result}
        onClose={() => {
          setResult(null);
          clipboard.setValue('');
          result && navigate(`/as/${asId}/sbes/${sbeId}/applications/${result.applicationId}`);
        }}
      >
        <ModalOverlay />
        <ModalContent borderTop="10px solid" borderColor="green.300">
          <ModalHeader>Application registered</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text as="b">Use this link to see your new credentials: </Text>
            <Link href={clipboard.value} color="blue.500">
              {clipboard.value}
            </Link>
            <Text my={5} as="p" fontStyle="italic">
              Note: this link will work only once, and will expire after 7 days.
            </Text>
          </ModalBody>
        </ModalContent>
      </Modal>
      <form
        onSubmit={handleSubmit((data) => {
          return postApplication.mutateAsync(data, mutationErrCallback({ popBanner, setError }));
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
      </form>
    </PageTemplate>
  );
};
