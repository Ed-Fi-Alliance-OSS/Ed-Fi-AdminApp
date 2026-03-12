import { Button, ButtonGroup, FormControl, FormLabel, Select } from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClientQueriesV2 } from '../../api';
import { useTeamEdfiTenantNavContextLoaded } from '../../helpers';
import certificationScenarios from './certification-scenarios.json';

const dataStandardOptions = ['v4'];

type CertificationScenario = {
  scenariosGroup?: string;
  scenariosName?: string;
  scenarioStep?: string;
};

type ApiClientOption = {
  id?: number;
  name?: string;
};

const hasName = (item: ApiClientOption): item is ApiClientOption & { name: string } =>
  Boolean(item.name?.trim());

const getUniqueOptions = (values: Array<string | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((a, b) =>
    a.localeCompare(b)
  );

const scenarios = certificationScenarios as CertificationScenario[];
const areaOrGroupOptions = getUniqueOptions(scenarios.map((item) => item.scenariosGroup));

export const RequestCertificationPage = () => {
  const navigate = useNavigate();
  const { applicationId } = useParams() as { applicationId: string };
  const applicationIdNumber = Number(applicationId);
  const { asId, edfiTenant } = useTeamEdfiTenantNavContextLoaded();
  const [selectedCredential, setSelectedCredential] = useState('');
  const [selectedDataStandard, setSelectedDataStandard] = useState('v4');
  const [selectedAreaOrGroup, setSelectedAreaOrGroup] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('');
  const [selectedStep, setSelectedStep] = useState('');

  const apiClients = useQuery(
    apiClientQueriesV2.getAll(
      {
        teamId: asId,
        edfiTenant,
      },
      {
        applicationId: applicationIdNumber,
      }
    )
  );

  const credentialOptions = useMemo(
    () =>
      (Object.values(apiClients?.data || {}) as ApiClientOption[])
        .filter(hasName)
        .map((item) => ({ value: String(item.id ?? item.name), label: item.name })),
    [apiClients?.data]
  );

  const scenarioOptions = useMemo(
    () =>
      getUniqueOptions(
        scenarios
          .filter((item) => item.scenariosGroup === selectedAreaOrGroup)
          .map((item) => item.scenariosName)
      ),
    [selectedAreaOrGroup]
  );

  const stepOptions = useMemo(
    () =>
      getUniqueOptions(
        scenarios
          .filter(
            (item) =>
              item.scenariosGroup === selectedAreaOrGroup && item.scenariosName === selectedScenario
          )
          .map((item) => item.scenarioStep)
      ),
    [selectedAreaOrGroup, selectedScenario]
  );

  const goToApplication = () => {
    navigate(
      `/as/${asId}/sb-environments/${edfiTenant.sbEnvironmentId}/edfi-tenants/${edfiTenant.id}/applications/${applicationId}`
    );
  };

  const canValidateScenario = Boolean(
    selectedCredential &&
      selectedDataStandard &&
      selectedAreaOrGroup &&
      selectedScenario &&
      selectedStep
  );

  return (
    <PageTemplate title="Request Certification">
      <form>
        <FormControl>
          <FormLabel>Credentials</FormLabel>
          <Select
            placeholder="Select Credentials"
            value={selectedCredential}
            isDisabled={apiClients.isLoading}
            onChange={(event) => setSelectedCredential(event.target.value)}
          >
            {credentialOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Data Standard</FormLabel>
          <Select
            placeholder="Select data standard"
            value={selectedDataStandard}
            onChange={(event) => setSelectedDataStandard(event.target.value)}
          >
            {dataStandardOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Area or Group</FormLabel>
          <Select
            placeholder="Select area or group"
            value={selectedAreaOrGroup}
            onChange={(event) => {
              setSelectedAreaOrGroup(event.target.value);
              setSelectedScenario('');
              setSelectedStep('');
            }}
          >
            {areaOrGroupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Scenario</FormLabel>
          <Select
            placeholder={selectedAreaOrGroup ? 'Select scenario' : 'Select area or group first'}
            value={selectedScenario}
            isDisabled={!selectedAreaOrGroup}
            onChange={(event) => {
              setSelectedScenario(event.target.value);
              setSelectedStep('');
            }}
          >
            {scenarioOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormControl>

        <FormControl>
          <FormLabel>Step</FormLabel>
          <Select
            placeholder={selectedScenario ? 'Select step' : 'Select scenario first'}
            value={selectedStep}
            isDisabled={!selectedScenario}
            onChange={(event) => setSelectedStep(event.target.value)}
          >
            {stepOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </FormControl>

        <ButtonGroup mt={4}>
          <Button colorScheme="primary" type="button" isDisabled={!canValidateScenario}>
            Validate Scenario
          </Button>
          <Button variant="ghost" type="button" onClick={goToApplication}>
            Cancel
          </Button>
        </ButtonGroup>
      </form>
    </PageTemplate>
  );
};
