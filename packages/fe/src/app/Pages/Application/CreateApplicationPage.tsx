import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Select,
  Text,
  Link,
  useClipboard,
} from '@chakra-ui/react';
import {
  ApplicationYopassResponseDto,
  PostApplicationDto,
  PutApplicationDto,
} from '@edanalytics/models';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { useNavigate, useParams, Link as RouterLink } from '@tanstack/router';
import { ReactNode, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  claimsetQueries,
  edorgQueries,
  useApplicationPost,
  vendorQueries,
} from '../../api';
import { useNavToParent } from '../../helpers';
import { applicationIndexRoute, applicationRoute } from '../../routes';
const resolver = classValidatorResolver(PutApplicationDto);

export const CreateApplicationPage = (): ReactNode => {
  const navigate = useNavigate();
  const params = useParams({ from: applicationIndexRoute.id });
  const navToParentOptions = useNavToParent();
  const edorgs = edorgQueries.useAll({
    tenantId: params.asId,
    sbeId: params.sbeId,
  });
  const vendors = vendorQueries.useAll({
    sbeId: params.sbeId,
    tenantId: params.asId,
  });
  const claimsets = claimsetQueries.useAll({
    tenantId: params.asId,
    sbeId: params.sbeId,
  });

  const goToView = (id: string) => {
    navigate({
      to: applicationRoute.fullPath,
      params: (old: any) => ({ ...old, applicationId: id }),
      search: {},
    });
  };
  const [result, setResult] = useState<ApplicationYopassResponseDto | null>(
    null
  );
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
  } = useForm<PostApplicationDto>({
    resolver,
    defaultValues: new PostApplicationDto(),
  });

  return (
    <>
      <Modal
        isOpen={!!result}
        onClose={() => {
          setResult(null);
          clipboard.setValue('');
          result && goToView(String(result.applicationId));
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Success!</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text as="b">Use this link to see your new credentials: </Text>
            <Link href={clipboard.value} color="blue.600">
              {clipboard.value}
            </Link>
            <Text my={5} as="p" fontStyle="italic">
              Note: this link will work only once, and will expire after 7 days.
            </Text>
          </ModalBody>
        </ModalContent>
      </Modal>
      <Heading mb={4} fontSize="lg">
        New Application
      </Heading>
      <Box maxW="40em" borderTop="1px solid" borderColor="gray.200">
        <form
          onSubmit={handleSubmit((data) => {
            postApplication.mutate(data);
          })}
        >
          {/* TODO: replace this with real content */}
          <FormControl isInvalid={!!errors.applicationName}>
            <FormLabel>Application name</FormLabel>
            <Input {...register('applicationName')} placeholder="name" />
            <FormErrorMessage>
              {errors.applicationName?.message}
            </FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.educationOrganizationId}>
            <FormLabel>Ed-org</FormLabel>
            <Controller
              control={control}
              name="educationOrganizationId"
              render={(props) => (
                <Select
                  placeholder="Select an Ed-org"
                  {...props.field}
                  onChange={(event) => {
                    props.field.onChange(Number(event.target.value));
                  }}
                >
                  {Object.values(edorgs.data ?? {}).map((edorg) => {
                    return (
                      <option
                        key={edorg.id}
                        value={edorg.educationOrganizationId}
                      >
                        {edorg.displayName}
                      </option>
                    );
                  })}
                </Select>
              )}
            />
            <FormErrorMessage>
              {errors.educationOrganizationIds?.message}
            </FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.vendorId}>
            <FormLabel>Vendor</FormLabel>
            <Controller
              control={control}
              name="vendorId"
              render={(props) => (
                <Select
                  placeholder="Select a vendor"
                  {...props.field}
                  onChange={(event) => {
                    props.field.onChange(Number(event.target.value));
                  }}
                >
                  {Object.values(vendors.data ?? {}).map((vendor) => {
                    return (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.displayName}
                      </option>
                    );
                  })}
                </Select>
              )}
            />
            <FormErrorMessage>{errors.vendorId?.message}</FormErrorMessage>
          </FormControl>
          <FormControl isInvalid={!!errors.claimSetName}>
            <FormLabel>Claimset</FormLabel>
            <Select
              placeholder="Select a claimset"
              {...register('claimSetName')}
            >
              {Object.values(claimsets.data ?? {}).map((claimset) => {
                return (
                  <option value={claimset.name}>{claimset.displayName}</option>
                );
              })}
            </Select>
            <FormErrorMessage>{errors.claimSetName?.message}</FormErrorMessage>
          </FormControl>
          <ButtonGroup>
            <Button
              mt={4}
              colorScheme="teal"
              isLoading={isLoading}
              type="submit"
            >
              Save
            </Button>
            <Button
              mt={4}
              colorScheme="teal"
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
      </Box>
    </>
  );
};
