
import { Button, ButtonGroup, FormControl, FormLabel, Input, Select } from '@chakra-ui/react';
import { PageTemplate } from '@edanalytics/common-ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import certificationScenarios from './certification-scenarios.json';
import { useNavToParent } from '../../helpers';
import { config } from '../../../config/config';

const dataStandardOptions = ['v4'];

type CertificationScenario = {
  scenariosGroup?: string;
  scenariosName?: string;
  scenarioStep?: string;
};

const getUniqueOptions = (values: Array<string | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim())))).sort((a, b) =>
    a.localeCompare(b)
  );

const scenarios = certificationScenarios as CertificationScenario[];
const areaOrGroupOptions = getUniqueOptions(scenarios.map((item) => item.scenariosGroup));

export const RequestCertificationPage = () => {
  if (!config.showRequestCertification) {
    return null;
  }

  const navigate = useNavigate();
  const [keyValue, setKeyValue] = useState('');
  const [secretValue, setSecretValue] = useState('');
  const [selectedDataStandard, setSelectedDataStandard] = useState('v4');
  const [selectedAreaOrGroup, setSelectedAreaOrGroup] = useState('');
  const [selectedScenario, setSelectedScenario] = useState('');
  const [selectedStep, setSelectedStep] = useState('');

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

  const navToParentOptions = useNavToParent();

  const canValidateScenario = Boolean(
    keyValue.trim() &&
      secretValue.trim() &&
      selectedDataStandard &&
      selectedAreaOrGroup &&
      selectedScenario &&
      selectedStep
  );

  return (
    <PageTemplate title="Request Certification">
      <form>
        <FormControl>
          <FormLabel>Key</FormLabel>
          <Input
            placeholder="Enter key"
            value={keyValue}
            onChange={(event) => setKeyValue(event.target.value)}
          />
        </FormControl>

        <FormControl>
          <FormLabel>Secret</FormLabel>
          <Input
            placeholder="Enter secret"
            type="password"
            value={secretValue}
            onChange={(event) => setSecretValue(event.target.value)}
          />
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
          <Button
            variant="ghost"
            isLoading={false}
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
