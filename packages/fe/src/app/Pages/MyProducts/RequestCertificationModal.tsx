import {
  Alert,
  AlertIcon,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Stack,
} from '@chakra-ui/react';
import {
  CertModel,
  SUPPORTED_CERT_MODELS,
  certRunAlreadyOpenMessage,
  resolveOdsApiUrls,
  supportsCertification,
} from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { edfiTenantQueries, odsQueries, sbEnvironmentQueries } from '../../api';
import { getOdsTerminology } from '../../helpers';
import { certificationRunPath } from '../../routes/paths';
import { CertificationAuthenticateForm } from '../CertificationV2/CertificationAuthenticateForm';
import { isAuthValidFor, useCertificationAuth } from '../CertificationV2/CertificationAuthContext';
import {
  certificationRunErrorMessage,
  useLatestCertificationRuns,
  useStartCertificationRun,
} from '../CertificationV2/useCertificationRun';

const toId = (value: string) => Number(value) || undefined;

/**
 * Where a vendor starts a certification run (AC-651): choose one of the team's data stores,
 * prove they hold its credentials, choose a Certification Model, then Start Run. Every list
 * comes from the team's own endpoints, so it only shows what the team owns.
 */
export const RequestCertificationModal = ({
  teamId,
  isOpen,
  onClose,
}: {
  teamId: number;
  isOpen: boolean;
  onClose: () => void;
}) => {
  const navigate = useNavigate();
  const { auth } = useCertificationAuth();
  const [sbEnvironmentId, setSbEnvironmentId] = useState<number>();
  const [edfiTenantId, setEdfiTenantId] = useState<number>();
  const [odsId, setOdsId] = useState<number>();
  const [chosenModel, setChosenModel] = useState<CertModel>();

  const environmentsQuery = useQuery(sbEnvironmentQueries.getAll({ teamId, enabled: isOpen }));
  // The API refuses environments below the minimum data model, so they aren't offered.
  const environments = useMemo(
    () =>
      Object.values(environmentsQuery.data ?? {}).filter((environment) =>
        supportsCertification(environment.odsDsVersion),
      ),
    [environmentsQuery.data],
  );
  const sbEnvironment = environments.find((environment) => environment.id === sbEnvironmentId);

  const tenantsQuery = useQuery(
    edfiTenantQueries.getAll({
      teamId,
      sbEnvironmentId: sbEnvironmentId as number,
      enabled: isOpen && !!sbEnvironment,
    }),
  );
  const tenants = useMemo(
    () => (sbEnvironment ? Object.values(tenantsQuery.data ?? {}) : []),
    [sbEnvironment, tenantsQuery.data],
  );
  const edfiTenant = tenants.find((tenant) => tenant.id === edfiTenantId);

  const odsQuery = useQuery(
    odsQueries.getAll({ teamId, edfiTenant: edfiTenant!, enabled: isOpen && !!edfiTenant }),
  );
  const odss = useMemo(
    () => (edfiTenant ? Object.values(odsQuery.data ?? {}) : []),
    [edfiTenant, odsQuery.data],
  );
  const ods = odss.find((item) => item.id === odsId);

  // A list with a single option needs no choice.
  useEffect(() => {
    if (sbEnvironmentId === undefined && environments.length === 1) {
      setSbEnvironmentId(environments[0].id);
    }
  }, [sbEnvironmentId, environments]);
  useEffect(() => {
    if (edfiTenantId === undefined && tenants.length === 1) setEdfiTenantId(tenants[0].id);
  }, [edfiTenantId, tenants]);
  useEffect(() => {
    if (odsId === undefined && odss.length === 1) setOdsId(odss[0].id);
  }, [odsId, odss]);

  const { latestByModel, isPending: isLatestPending } = useLatestCertificationRuns({
    teamId,
    edfiTenantId: edfiTenant?.id,
    odsId: ods?.id,
  });
  const isModelOpen = (model: CertModel) => latestByModel[model]?.isOpen === true;
  const openModels = SUPPORTED_CERT_MODELS.filter(isModelOpen);
  const availableModels = SUPPORTED_CERT_MODELS.filter((model) => !isModelOpen(model));
  // A model that is the only one available is chosen; one whose run is open never is.
  const certificationModel =
    chosenModel && !isModelOpen(chosenModel)
      ? chosenModel
      : availableModels.length === 1
        ? availableModels[0]
        : undefined;

  const contextRouting =
    !!sbEnvironment &&
    !!edfiTenant &&
    resolveOdsApiUrls(sbEnvironment.configPublic?.odsApiMeta?.urls, edfiTenant.name).status ===
      'context-routing';

  const startRun = useStartCertificationRun();
  const { reset: resetStartRun } = startRun;
  // The key and secret are validated for one data store; another one needs its own check.
  const isAuthenticated = isAuthValidFor(auth, edfiTenant?.id, ods?.id);
  const canStart =
    !!ods &&
    !!edfiTenant &&
    !!certificationModel &&
    // An open run isn't known until the data store's runs have loaded.
    !isLatestPending &&
    isAuthenticated &&
    !contextRouting;

  const close = () => {
    setSbEnvironmentId(undefined);
    setEdfiTenantId(undefined);
    setOdsId(undefined);
    setChosenModel(undefined);
    resetStartRun();
    onClose();
  };

  const start = () => {
    if (!canStart) return;
    startRun.mutate(
      { teamId, edfiTenantId: edfiTenant.id, body: { odsId: ods.id, certificationModel } },
      { onSuccess: (run) => navigate(certificationRunPath(teamId, run.runId)) },
    );
  };

  const odsLabel = getOdsTerminology(sbEnvironment?.version).singular;
  const noEnvironments = !environmentsQuery.isPending && environments.length === 0;

  return (
    <Modal isOpen={isOpen} onClose={close} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Request New Certification</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Stack spacing={4}>
            {noEnvironments && (
              <Alert status="warning">
                <AlertIcon />
                Your team has no environment that can be certified. Certification requires Ed-Fi
                Data Standard 5.0.0 or later.
              </Alert>
            )}
            <FormControl>
              <FormLabel>Environment</FormLabel>
              <Select
                placeholder="Select environment"
                isDisabled={environments.length <= 1}
                value={sbEnvironment?.id ?? ''}
                onChange={(event) => {
                  setSbEnvironmentId(toId(event.target.value));
                  setEdfiTenantId(undefined);
                  setOdsId(undefined);
                }}
              >
                {environments.map((environment) => (
                  <option key={environment.id} value={environment.id}>
                    {environment.displayName}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>Tenant</FormLabel>
              <Select
                placeholder="Select tenant"
                isDisabled={tenants.length <= 1}
                value={edfiTenant?.id ?? ''}
                onChange={(event) => {
                  setEdfiTenantId(toId(event.target.value));
                  setOdsId(undefined);
                }}
              >
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.displayName}
                  </option>
                ))}
              </Select>
            </FormControl>

            <FormControl>
              <FormLabel>{odsLabel}</FormLabel>
              <Select
                placeholder={`Select ${odsLabel}`}
                isDisabled={odss.length <= 1}
                value={ods?.id ?? ''}
                onChange={(event) => setOdsId(toId(event.target.value))}
              >
                {odss.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName}
                  </option>
                ))}
              </Select>
            </FormControl>

            {contextRouting ? (
              <Alert status="warning">
                <AlertIcon />
                This environment uses context-based routing, which certification doesn&apos;t
                support yet.
              </Alert>
            ) : (
              <CertificationAuthenticateForm
                teamId={teamId}
                edfiTenantId={edfiTenant?.id}
                odsId={ods?.id}
                isDisabled={!ods}
              />
            )}

            <FormControl>
              <FormLabel>Certification Model</FormLabel>
              <Select
                placeholder="Select Certification Model"
                value={certificationModel ?? ''}
                onChange={(event) => setChosenModel((event.target.value || undefined) as CertModel)}
              >
                {SUPPORTED_CERT_MODELS.map((model) => (
                  <option key={model} value={model} disabled={isModelOpen(model)}>
                    {isModelOpen(model) ? `${model} (a run is already open)` : model}
                  </option>
                ))}
              </Select>
              {openModels.map((model) => (
                <FormHelperText key={model}>{certRunAlreadyOpenMessage(model)}</FormHelperText>
              ))}
            </FormControl>

            {startRun.error != null && (
              <Alert status="error" role="alert">
                <AlertIcon />
                {certificationRunErrorMessage(startRun.error)}
              </Alert>
            )}
          </Stack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" type="button" onClick={close}>
            Cancel
          </Button>
          <Button
            colorScheme="primary"
            type="button"
            // Disabled, not a spinner, while the run is created: the label stays readable.
            isDisabled={!canStart || startRun.isPending}
            onClick={start}
          >
            Start Run
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
