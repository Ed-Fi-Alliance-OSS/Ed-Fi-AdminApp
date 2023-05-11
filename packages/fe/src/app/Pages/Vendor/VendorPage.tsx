import { Box, Button, ButtonGroup, Heading } from '@chakra-ui/react';
import { ConfirmAction } from '@edanalytics/common-ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/router';
import { BiEdit, BiTrash } from 'react-icons/bi';
import { vendorQueries, userQueries } from '../../api';
import { vendorIndexRoute } from '../../routes';
import { useNavToParent } from '../../helpers';
import { EditVendor } from './EditVendor';
import { ViewVendor } from './ViewVendor';
import { ReactNode } from 'react';

export const VendorPage = (): ReactNode => {
  const navigate = useNavigate();
  const navToParentOptions = useNavToParent();

  const params = useParams({ from: vendorIndexRoute.id });
  const deleteVendor = vendorQueries.useDelete({
    sbeId: params.sbeId,
    tenantId: params.asId,
    callback: () => {
      navigate(navToParentOptions);
    },
  });
  const vendor = vendorQueries.useOne({
    tenantId: params.asId,
    id: params.vendorId,
    sbeId: params.sbeId,
  }).data;
  const { edit } = useSearch({ from: vendorIndexRoute.id });

  return (
    <>
      <Heading mb={4} fontSize="lg">
        {vendor?.company || 'Vendor'}
      </Heading>
      {vendor ? (
        <Box maxW="40em" borderTop="1px solid" borderColor="gray.200">
          <ButtonGroup
            spacing={6}
            display="flex"
            size="sm"
            variant="link"
            justifyContent="end"
          >
            <Button
              isDisabled={edit}
              iconSpacing={1}
              leftIcon={<BiEdit />}
              onClick={() => {
                navigate({
                  search: { edit: true },
                });
              }}
            >
              Edit
            </Button>
            {/* <ConfirmAction
              action={() => deleteVendor.mutate(vendor.id)}
              headerText={`Delete ${vendor.displayName}?`}
              bodyText="You won't be able to get it back"
            >
              {(props) => (
                <Button {...props} iconSpacing={1} leftIcon={<BiTrash />}>
                  Delete
                </Button>
              )}
            </ConfirmAction> */}
          </ButtonGroup>

          {edit ? <EditVendor /> : <ViewVendor />}
        </Box>
      ) : null}
    </>
  );
};
