import {
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  useClipboard,
} from '@chakra-ui/react';
import { GetApplicationDto, createEdorgCompositeNaturalKey } from '@edanalytics/models';
import { BiEdit, BiPlus, BiShieldX, BiTrash } from 'react-icons/bi';
import { HiOutlineEye } from 'react-icons/hi';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { applicationQueries, useApplicationResetCredential } from '../../api';
import {
  ActionPropsConfirm,
  ActionsType,
  AuthorizeComponent,
  LinkActionProps,
  useNavToParent,
} from '../../helpers';
import { useSearchParamsObject } from '../../helpers/useSearch';
import { memo, useMemo } from 'react';

export const useApplicationActions = ({
  application,
  sbeId,
  tenantId,
}: {
  application: GetApplicationDto | undefined;
  sbeId: string;
  tenantId: string;
}): ActionsType => {
  const navigate = useNavigate();
  const location = useLocation();

  const clipboard = useClipboard('');
  const deleteApplication = applicationQueries.useDelete({
    sbeId: sbeId,
    tenantId: tenantId,
  });

  const resetCreds = useApplicationResetCredential({
    sbeId: sbeId,
    tenantId: tenantId,
    callback: (result) => {
      clipboard.setValue(result.link);
    },
  });

  const onClose = useMemo(
    () => () => {
      clipboard.setValue('');
    },
    []
  );

  const search = useSearchParamsObject();
  const onApplicationPage =
    application && location.pathname.endsWith(`/applications/${application.id}`);
  const inEdit = onApplicationPage && 'edit' in search && search?.edit === 'true';

  const to = (id: number | string) => `/as/${tenantId}/sbes/${sbeId}/applications/${id}`;
  const parentPath = useNavToParent();

  return application === undefined
    ? {}
    : {
        View: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(application.id);
          return (
            <AuthorizeComponent
              config={{
                privilege: 'tenant.sbe.edorg.application:read',
                subject: {
                  sbeId: Number(sbeId),
                  tenantId: Number(tenantId),
                  id: createEdorgCompositeNaturalKey({
                    educationOrganizationId: application.educationOrganizationId,
                    odsDbName: '',
                  }),
                },
              }}
            >
              <props.children
                icon={HiOutlineEye}
                text="View"
                title={'View ' + application.displayName}
                to={path}
                onClick={() => navigate(path)}
              />
            </AuthorizeComponent>
          );
        },
        Reset: (props: { children: (props: ActionPropsConfirm) => JSX.Element }) => {
          return (
            <>
              <CredentialResetModal href={clipboard.value} onClose={onClose} />
              <AuthorizeComponent
                config={{
                  privilege: 'tenant.sbe.edorg.application:reset-credentials',
                  subject: {
                    sbeId: Number(sbeId),
                    tenantId: Number(tenantId),
                    id: createEdorgCompositeNaturalKey({
                      educationOrganizationId: application.educationOrganizationId,
                      odsDbName: '',
                    }),
                  },
                }}
              >
                <props.children
                  icon={() => (resetCreds.isLoading ? <Spinner size="sm" /> : <BiShieldX />)}
                  text="Reset creds"
                  title="Reset application credentials."
                  onClick={() => {
                    resetCreds.mutate(application);
                  }}
                  confirm
                  confirmBody="Are you sure you want to reset the credentials? Anything using the current ones will stop working."
                />
              </AuthorizeComponent>
            </>
          );
        },
        Edit: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
          const path = to(application.id);
          return (
            <AuthorizeComponent
              config={{
                privilege: 'tenant.sbe.edorg.application:update',
                subject: {
                  sbeId: Number(sbeId),
                  tenantId: Number(tenantId),
                  id: createEdorgCompositeNaturalKey({
                    educationOrganizationId: application.educationOrganizationId,
                    odsDbName: '',
                  }),
                },
              }}
            >
              <props.children
                isDisabled={inEdit}
                icon={BiEdit}
                text="Edit"
                title={'Edit ' + application.displayName}
                to={path + '?edit=true'}
                onClick={() => navigate(path + '?edit=true')}
              />
            </AuthorizeComponent>
          );
        },
        Delete: (props: { children: (props: ActionPropsConfirm) => JSX.Element }) => {
          return (
            <AuthorizeComponent
              config={{
                privilege: 'tenant.sbe.edorg.application:delete',
                subject: {
                  sbeId: Number(sbeId),
                  tenantId: Number(tenantId),
                  id: createEdorgCompositeNaturalKey({
                    educationOrganizationId: application.educationOrganizationId,
                    odsDbName: '',
                  }),
                },
              }}
            >
              <props.children
                icon={BiTrash}
                text="Delete"
                title="Delete application"
                confirmBody="All systems using this application to access Ed-Fi will no longer be able to do so. This action cannot be undone, though you will be able to create a new application if you want."
                onClick={() =>
                  deleteApplication.mutateAsync(application.id, {
                    onSuccess: () => {
                      if (onApplicationPage) {
                        navigate(parentPath);
                      }
                    },
                  })
                }
                confirm={true}
              />
            </AuthorizeComponent>
          );
        },
      };
};
export const useApplicationsActions = ({
  sbeId,
  tenantId,
}: {
  sbeId: string;
  tenantId: string;
}): ActionsType => {
  const navigate = useNavigate();
  const params = useParams() as { asId: string; sbeId: string };
  const to = `/as/${params.asId}/sbes/${params.sbeId}/applications/create`;
  return {
    Create: (props: { children: (props: LinkActionProps) => JSX.Element }) => {
      return (
        <AuthorizeComponent
          config={{
            privilege: 'tenant.sbe.edorg.application:create',
            subject: {
              sbeId: Number(sbeId),
              tenantId: Number(tenantId),
              id: '__filtered__',
            },
          }}
        >
          <props.children
            icon={BiPlus}
            text="New"
            title="New application"
            to={to}
            onClick={() => navigate(to)}
          />
        </AuthorizeComponent>
      );
    },
  };
};
const CredentialResetModal = memo((props: { href: string; onClose: () => void }) => {
  return (
    <Modal isOpen={props.href !== ''} onClose={props.onClose}>
      <ModalOverlay />
      <ModalContent borderTop="10px solid" borderColor="green.300">
        <ModalHeader>Credentials have been reset</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Text as="p">Use this one-time link to see your Key and Secret:</Text>
          <Link as={RouterLink} color="blue.500" to={props.href}>
            {props.href}
          </Link>
          <Text my={5} as="p" fontStyle="italic">
            Note: this link will work only once, and will expire after 7 days.
          </Text>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
});
