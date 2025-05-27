import { SelectWrapper, StandardSelector } from '../../helpers/StandardSelector';
import { useNavContext } from '../../helpers/navContext';
import { useGetManyIntegrationProviders } from '../../api-v2';

export const SelectIntegrationProvider: StandardSelector = (props) => {
  const { options: externalOptions, ...others } = props;

  const { data: integrationProviders, isPending, isStale } = useGetManyIntegrationProviders({});

  const options = externalOptions ?? {};
  if (!externalOptions) {
    if (integrationProviders) {
      integrationProviders.forEach((integrationProvider) => {
        options[integrationProvider.id] = {
          value: integrationProvider.id,
          label: integrationProvider.name,
        };
      });
    }
  }

  return <SelectWrapper {...others} options={options} isLoading={isPending || isStale} />;
};
