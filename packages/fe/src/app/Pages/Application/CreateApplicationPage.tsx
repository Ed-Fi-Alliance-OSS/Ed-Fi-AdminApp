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
import { ApplicationYopassResponseDto, PostApplicationForm } from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useApplicationPost } from '../../api';
import { useNavToParent } from '../../helpers';
import { SelectClaimset, SelectEdorg, SelectVendor } from '../../helpers/FormPickers';
import { PageTemplate } from '../PageTemplate';
const resolver = classValidatorResolver(PostApplicationForm);

export const CreateApplicationPage = () => {
  const navigate = useNavigate();
  const params = useParams() as { asId: string; sbeId: string };
  const navToParentOptions = useNavToParent();

  const [result, setResult] = useState<ApplicationYopassResponseDto | null>(null);
  const clipboard = useClipboard('');

  const postApplication = useApplicationPost({
    sbeId: params.sbeId,
    tenantId: params.asId,
    callback: (result) => {
      setResult(result);
      clipboard.setValue(result.link);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isLoading },
    control,
  } = useForm<PostApplicationForm>({
    resolver,
    defaultValues: new PostApplicationForm(),
  });

  return (
    <PageTemplate title="New application">
      <Modal
        isOpen={!!result}
        onClose={() => {
          setResult(null);
          clipboard.setValue('');
          result &&
            navigate(
              `/as/${params.asId}/sbes/${params.sbeId}/applications/${result.applicationId}`
            );
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
          postApplication.mutate(data);
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
            tenantId={params.asId}
            name="educationOrganizationId"
            useEdorgId
            sbeId={params.sbeId}
            control={control}
          />
          <FormErrorMessage>{errors.educationOrganizationId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.vendorId}>
          <FormLabel>Vendor</FormLabel>
          <SelectVendor
            tenantId={params.asId}
            name="vendorId"
            sbeId={params.sbeId}
            control={control}
          />
          <FormErrorMessage>{errors.vendorId?.message}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.claimSetName}>
          <FormLabel>Claimset</FormLabel>
          <SelectClaimset
            useName
            tenantId={params.asId}
            name="claimSetName"
            sbeId={params.sbeId}
            control={control}
          />
          <FormErrorMessage>{errors.claimSetName?.message}</FormErrorMessage>
        </FormControl>
        <ButtonGroup mt={4} colorScheme="teal">
          <Button isLoading={isLoading} type="submit">
            Save
          </Button>
          <Button
            variant="ghost"
            isLoading={isLoading}
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
