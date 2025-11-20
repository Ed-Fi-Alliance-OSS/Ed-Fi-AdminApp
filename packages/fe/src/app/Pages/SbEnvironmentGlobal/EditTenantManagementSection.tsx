import {
  Box,
  Button,
  ButtonGroup,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Input,
  Stack,
  Text,
  Tooltip,
  chakra,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionIcon,
  AccordionPanel,
  Table,
  Thead,
  Th,
  Tr,
  Tbody,
  Td,
  Alert,
  AlertIcon,
} from '@chakra-ui/react';
import { Icons } from '@edanalytics/common-ui';
import { PutSbEnvironmentDto, PostSbEnvironmentTenantDTO } from '@edanalytics/models';
import { FieldErrors, UseFormGetValues, UseFormRegister, UseFormSetValue, UseFormClearErrors } from 'react-hook-form';

// Type for tenant data used in form
type Tenant = PostSbEnvironmentTenantDTO & { id?: number };

interface EditTenantManagementSectionProps {
  isMultitenant: boolean
  tenants: Tenant[]
  register: UseFormRegister<PutSbEnvironmentDto>
  setValue: UseFormSetValue<PutSbEnvironmentDto>
  getValues: UseFormGetValues<PutSbEnvironmentDto>
  errors: FieldErrors<PutSbEnvironmentDto>
  clearErrors: UseFormClearErrors<PutSbEnvironmentDto>
}

export const EditTenantManagementSection = ({
  isMultitenant,
  tenants,
  register,
  setValue,
  getValues,
  errors,
  clearErrors,
}: EditTenantManagementSectionProps) => {

  if (isMultitenant) {
    // Multi-tenant mode
    return (
      <Box>
        <FormControl>
          <FormLabel>
            Tenants{' '}
            <Tooltip label="Edit tenants for this multi-tenant deployment" hasArrow>
              <chakra.span>
                <Icons.InfoCircle />
              </chakra.span>
            </Tooltip>
          </FormLabel>

          {tenants.length > 0 && (
            <Alert status="info" mb={4}>
              <AlertIcon />
              <Text fontSize="sm">
                Editing existing tenant configuration. You can modify tenant names, add/remove ODS instances,
                or add new tenants. Changes will be applied when you save.
              </Text>
            </Alert>
          )}

          <Text fontSize="sm" color="orange.600" mb={2}>
            ⚠️ Ensure all tenant names are properly configured in your Admin API before proceeding
          </Text>

          {/* Hidden field for tenant-level errors */}
          <FormControl isInvalid={!!errors.tenants} display="none">
            <Input {...register('tenants')} type="hidden" />
          </FormControl>
          {errors.tenants?.message && (
            <Text color="red.500" fontSize="sm" mb={2}>
              {errors.tenants.message}
            </Text>
          )}

          <Stack spacing={2}>
            <ButtonGroup size="sm">
              <Button
                onClick={() => {
                  const currentTenants = getValues('tenants') || [];
                  const newTenant: PostSbEnvironmentTenantDTO = {
                    name: `tenant${currentTenants.length + 1}`,
                    odss: [],
                  };
                  setValue('tenants', [...currentTenants, newTenant]);
                }}
              >
                Add Tenant
              </Button>
            </ButtonGroup>

            {tenants.length > 0 && (
              <Accordion defaultIndex={[0]} allowMultiple>
                {tenants.map((tenant, index) => (
                  <AccordionItem key={tenant.id || `tenant-${index}`}>
                    <Box display="flex" alignItems="center">
                      <AccordionButton flex="1">
                        <Box flex="1" textAlign="left">
                          <Text fontWeight="bold">{tenant.name}</Text>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <Button
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        ml={2}
                        onClick={() => {
                          const currentTenants = getValues('tenants') || [];
                          const updatedTenants = [...currentTenants];
                          if (updatedTenants[index]) {
                            updatedTenants.splice(index, 1);
                          }
                          setValue('tenants', updatedTenants);
                          clearErrors('tenants');
                        }}
                        aria-label={`Remove tenant ${tenant.name}`}
                      >
                        Remove
                      </Button>
                    </Box>
                    <AccordionPanel pb={4}>
                      <Box flex="1" textAlign="left">
                        <Stack spacing={2} w="full">
                          {/* Tenant Name */}
                          <FormControl isInvalid={!!errors.tenants?.[index]?.name}>
                            <FormLabel>
                              Tenant Name{' '}
                              <Tooltip label="The tenant key you set in appsettings file" hasArrow>
                                <chakra.span>
                                  <Icons.InfoCircle />
                                </chakra.span>
                              </Tooltip>
                            </FormLabel>
                            <Input
                              value={tenant.name || ''}
                              placeholder="Tenant name"
                              onChange={(e) => {
                                const currentTenants = getValues('tenants') || [];
                                const updatedTenants = [...currentTenants];
                                if (updatedTenants[index]) {
                                  updatedTenants[index] = {
                                    ...updatedTenants[index],
                                    name: e.target.value
                                  };
                                  setValue('tenants', updatedTenants);
                                }
                              }}
                            />
                            <FormErrorMessage>{errors.tenants?.[index]?.name?.message}</FormErrorMessage>
                          </FormControl>

                          {/* ODS Instances */}
                          <FormControl isInvalid={!!errors.tenants?.[index]?.odss}>
                            <FormLabel>
                              ODS Instances{' '}
                              <Tooltip label="Add the ODS Instances for the tenant" hasArrow>
                                <chakra.span>
                                  <Icons.InfoCircle />
                                </chakra.span>
                              </Tooltip>
                            </FormLabel>

                            <ButtonGroup size="sm" mb={2}>
                              <Button
                                onClick={() => {
                                  const currentTenants = getValues('tenants') || [];
                                  const updatedTenants = [...currentTenants];
                                  if (!updatedTenants[index].odss) {
                                    updatedTenants[index].odss = [];
                                  }
                                  const currentOdss = updatedTenants[index].odss;
                                  const idArray = currentOdss.map(o => typeof o.id === 'number' ? o.id : 0);
                                  const maxId = idArray.length > 0 ? Math.max(...idArray) : 0;
                                  updatedTenants[index].odss.push({
                                    id: maxId + 1,
                                    name: `ODS ${maxId + 1}`,
                                    dbName: `ODS_${maxId + 1}`,
                                    allowedEdOrgs: '',
                                  });
                                  setValue('tenants', updatedTenants);
                                  clearErrors(`tenants.${index}.odss`);
                                }}
                              >
                                Add ODS
                              </Button>
                            </ButtonGroup>

                            <FormErrorMessage>{errors.tenants?.[index]?.odss?.message}</FormErrorMessage>

                            <Box>
                              <Table variant="simple" size="sm">
                                <Thead>
                                  <Tr>
                                    <Th>
                                      ODS Name{' '}
                                      <Tooltip label="ODS name in Admin API" hasArrow>
                                        <chakra.span>
                                          <Icons.InfoCircle />
                                        </chakra.span>
                                      </Tooltip>
                                    </Th>
                                    <Th>
                                      DB Name{' '}
                                      <Tooltip label="Database name for the ODS instance" hasArrow>
                                        <chakra.span>
                                          <Icons.InfoCircle />
                                        </chakra.span>
                                      </Tooltip>
                                    </Th>
                                    <Th>
                                      Education Organization Identifier(s){' '}
                                      <Tooltip label="Comma separated list of Education Organization IDs managed in this instance" hasArrow>
                                        <chakra.span>
                                          <Icons.InfoCircle />
                                        </chakra.span>
                                      </Tooltip>
                                    </Th>
                                    <Th>Actions</Th>
                                  </Tr>
                                </Thead>
                                {tenant.odss && tenant.odss.length > 0 && (
                                  <Tbody>
                                    {tenant.odss.map((ods, odsIndex) => (
                                      <Tr key={odsIndex}>
                                        <Td>
                                          <FormControl isInvalid={!!errors.tenants?.[index]?.odss?.[odsIndex]?.name}>
                                            <Input
                                              value={ods.name || ''}
                                              placeholder="ODS name"
                                              size="sm"
                                              onChange={(e) => {
                                                const currentTenants = getValues('tenants') || [];
                                                const updatedTenants = [...currentTenants];
                                                if (updatedTenants[index]?.odss?.[odsIndex]) {
                                                  updatedTenants[index].odss[odsIndex] = {
                                                    ...updatedTenants[index].odss[odsIndex],
                                                    name: e.target.value
                                                  };
                                                  setValue('tenants', updatedTenants);
                                                }
                                              }}
                                            />
                                            <FormErrorMessage>{errors.tenants?.[index]?.odss?.[odsIndex]?.name?.message}</FormErrorMessage>
                                          </FormControl>
                                        </Td>
                                        <Td>
                                          <FormControl isInvalid={!!errors.tenants?.[index]?.odss?.[odsIndex]?.dbName}>
                                            <Input
                                              value={ods.dbName || ''}
                                              placeholder="DB name"
                                              size="sm"
                                              onChange={(e) => {
                                                const currentTenants = getValues('tenants') || [];
                                                const updatedTenants = [...currentTenants];
                                                if (updatedTenants[index]?.odss?.[odsIndex]) {
                                                  updatedTenants[index].odss[odsIndex] = {
                                                    ...updatedTenants[index].odss[odsIndex],
                                                    dbName: e.target.value
                                                  };
                                                  setValue('tenants', updatedTenants);
                                                }
                                              }}
                                            />
                                            <FormErrorMessage>{errors.tenants?.[index]?.odss?.[odsIndex]?.dbName?.message}</FormErrorMessage>
                                          </FormControl>
                                        </Td>
                                        <Td>
                                          <FormControl isInvalid={!!errors.tenants?.[index]?.odss?.[odsIndex]?.allowedEdOrgs}>
                                            <Input
                                              value={ods.allowedEdOrgs || ''}
                                              placeholder="1, 255901, 25590100"
                                              size="sm"
                                              onChange={(e) => {
                                                const currentTenants = getValues('tenants') || [];
                                                const updatedTenants = [...currentTenants];
                                                if (updatedTenants[index]?.odss?.[odsIndex]) {
                                                  updatedTenants[index].odss[odsIndex] = {
                                                    ...updatedTenants[index].odss[odsIndex],
                                                    allowedEdOrgs: e.target.value
                                                  };
                                                  setValue('tenants', updatedTenants);
                                                }
                                              }}
                                            />
                                            <FormErrorMessage>{errors.tenants?.[index]?.odss?.[odsIndex]?.allowedEdOrgs?.message}</FormErrorMessage>
                                          </FormControl>
                                        </Td>
                                        <Td>
                                          <Button
                                            size="sm"
                                            colorScheme="red"
                                            variant="ghost"
                                            onClick={() => {
                                              const currentTenants = getValues('tenants') || [];
                                              const updatedTenants = [...currentTenants];
                                              if (updatedTenants[index]?.odss) {
                                                updatedTenants[index].odss.splice(odsIndex, 1);
                                              }
                                              setValue('tenants', updatedTenants);
                                              clearErrors(`tenants.${index}.odss`);
                                            }}
                                          >
                                            Remove
                                          </Button>
                                        </Td>
                                      </Tr>
                                    ))}
                                  </Tbody>
                                )}
                              </Table>
                            </Box>
                          </FormControl>
                        </Stack>
                      </Box>
                    </AccordionPanel>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </Stack>
        </FormControl>
      </Box>
    );
  } else {
    // Single-tenant mode - Match original styling
    return (
      <Box>
        <FormControl isInvalid={!!errors.tenants?.[0]?.odss}>
          <FormLabel>
            ODS Instances{' '}
            <Tooltip label="Configure ODS instances for the single-tenant deployment" hasArrow>
              <chakra.span>
                <Icons.InfoCircle />
              </chakra.span>
            </Tooltip>
          </FormLabel>

          {tenants.length > 0 && tenants[0]?.odss && tenants[0].odss.length > 0 && (
            <Alert status="info" mb={4}>
              <AlertIcon />
              <Text fontSize="sm">
                Editing existing ODS configuration. You can modify ODS instances or add new ones.
              </Text>
            </Alert>
          )}

          <ButtonGroup size="sm" mb={2}>
            <Button
              onClick={() => {
                const currentTenants = getValues('tenants') || [];
                // Ensure we have a default tenant
                if (currentTenants.length === 0) {
                  setValue('tenants', [{
                    name: 'default',
                    odss: []
                  }]);
                }
                const updatedTenants = [...currentTenants];
                const defaultTenant = updatedTenants[0] || { name: 'default', odss: [] };
                if (!defaultTenant.odss) {
                  defaultTenant.odss = [];
                }
                // Find the max id currently in use and increment by 1 for the new ODS instance
                const currentOdss = defaultTenant.odss;
                const idArray = currentOdss.map(o => typeof o.id === 'number' ? o.id : 0);
                const maxId = idArray.length > 0 ? Math.max(...idArray) : 0;
                defaultTenant.odss.push({
                  id: maxId + 1,
                  name: `ODS ${maxId + 1}`,
                  dbName: `ODS_${maxId + 1}`,
                  allowedEdOrgs: '',
                });
                updatedTenants[0] = defaultTenant;
                setValue('tenants', updatedTenants);
                clearErrors('tenants.0.odss');
              }}
            >
              Add ODS Instance
            </Button>
          </ButtonGroup>

          <FormErrorMessage>{errors.tenants?.[0]?.odss?.message}</FormErrorMessage>

          <Box>
            <Table variant="simple" size="sm">
              <Thead>
                <Tr>
                  <Th>
                    ODS Name{' '}
                    <Tooltip label="ODS name in Admin API" hasArrow>
                      <chakra.span>
                        <Icons.InfoCircle />
                      </chakra.span>
                    </Tooltip>
                  </Th>
                  <Th>
                    DB Name{' '}
                    <Tooltip label="Database name for the ODS instance" hasArrow>
                      <chakra.span>
                        <Icons.InfoCircle />
                      </chakra.span>
                    </Tooltip>
                  </Th>
                  <Th>
                    Education Organization Identifier(s){' '}
                    <Tooltip label="Comma separated list of Education Organization IDs managed in this instance" hasArrow>
                      <chakra.span>
                        <Icons.InfoCircle />
                      </chakra.span>
                    </Tooltip>
                  </Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              {tenants.length > 0 && tenants[0]?.odss && tenants[0].odss.length > 0 && (
                <Tbody>
                  {tenants[0].odss.map((ods, odsIndex) => (
                    <Tr key={odsIndex}>
                      <Td>
                        <FormControl isInvalid={!!errors.tenants?.[0]?.odss?.[odsIndex]?.name}>
                          <Input
                            value={ods.name || ''}
                            placeholder="ODS name"
                            size="sm"
                            onChange={(e) => {
                              const currentTenants = getValues('tenants') || [];
                              const updatedTenants = [...currentTenants];
                              if (updatedTenants[0]?.odss?.[odsIndex]) {
                                updatedTenants[0].odss[odsIndex] = {
                                  ...updatedTenants[0].odss[odsIndex],
                                  name: e.target.value
                                };
                                setValue('tenants', updatedTenants);
                              }
                            }}
                          />
                          <FormErrorMessage>{errors.tenants?.[0]?.odss?.[odsIndex]?.name?.message}</FormErrorMessage>
                        </FormControl>
                      </Td>
                      <Td>
                        <FormControl isInvalid={!!errors.tenants?.[0]?.odss?.[odsIndex]?.dbName}>
                          <Input
                            value={ods.dbName || ''}
                            placeholder="DB name"
                            size="sm"
                            onChange={(e) => {
                              const currentTenants = getValues('tenants') || [];
                              const updatedTenants = [...currentTenants];
                              if (updatedTenants[0]?.odss?.[odsIndex]) {
                                updatedTenants[0].odss[odsIndex] = {
                                  ...updatedTenants[0].odss[odsIndex],
                                  dbName: e.target.value
                                };
                                setValue('tenants', updatedTenants);
                              }
                            }}
                          />
                          <FormErrorMessage>{errors.tenants?.[0]?.odss?.[odsIndex]?.dbName?.message}</FormErrorMessage>
                        </FormControl>
                      </Td>
                      <Td>
                        <FormControl isInvalid={!!errors.tenants?.[0]?.odss?.[odsIndex]?.allowedEdOrgs}>
                          <Input
                            value={ods.allowedEdOrgs || ''}
                            placeholder="1, 255901, 25590100"
                            size="sm"
                            onChange={(e) => {
                              const currentTenants = getValues('tenants') || [];
                              const updatedTenants = [...currentTenants];
                              if (updatedTenants[0]?.odss?.[odsIndex]) {
                                updatedTenants[0].odss[odsIndex] = {
                                  ...updatedTenants[0].odss[odsIndex],
                                  allowedEdOrgs: e.target.value
                                };
                                setValue('tenants', updatedTenants);
                              }
                            }}
                          />
                          <FormErrorMessage>{errors.tenants?.[0]?.odss?.[odsIndex]?.allowedEdOrgs?.message}</FormErrorMessage>
                        </FormControl>
                      </Td>
                      <Td>
                        <Button
                          size="sm"
                          colorScheme="red"
                          variant="ghost"
                          onClick={() => {
                            const currentTenants = getValues('tenants') || [];
                            const updatedTenants = [...currentTenants];
                            if (updatedTenants[0]?.odss) {
                              updatedTenants[0].odss.splice(odsIndex, 1);
                            }
                            setValue('tenants', updatedTenants);
                            clearErrors('tenants.0.odss');
                          }}
                        >
                          Remove
                        </Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              )}
            </Table>
          </Box>
        </FormControl>
      </Box>
    );
  }
};
