import { FormControl, FormLabel, Switch, useBoolean } from '@chakra-ui/react';
import { GetSbeDto, regarding } from '@edanalytics/models';
import { StatusType } from '@edanalytics/utils';
import { useEffect } from 'react';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { useSbeCheckAdminAPI } from '../../api';
import { RegisterSbeAdminApiAuto } from './RegisterSbeAdminApiAuto';
import { RegisterSbeAdminApiManual } from './RegisterSbeAdminApiManual';

export const RegisterSbeAdminApi = (props: { sbe: GetSbeDto }) => {
  const checkConnection = useSbeCheckAdminAPI();
  const popBanner = usePopBanner();
  useEffect(() => {
    checkConnection.mutate(sbe, {
      onError: () => undefined,
      onSuccess: (res) => {
        popBanner({
          title: 'Admin API already connected.',
          status: StatusType.warning,
          regarding: regarding(sbe),
        });
      },
    });
  }, []);
  const { sbe } = props;

  const [selfRegister, setSelfRegister] = useBoolean(true);

  return sbe ? (
    <>
      <FormControl mb={10}>
        <FormLabel>Use automatic self-registration?</FormLabel>
        <Switch isChecked={selfRegister} onChange={setSelfRegister.toggle} />
      </FormControl>
      {selfRegister ? (
        <RegisterSbeAdminApiAuto sbe={sbe} />
      ) : (
        <RegisterSbeAdminApiManual sbe={sbe} />
      )}
    </>
  ) : null;
};
