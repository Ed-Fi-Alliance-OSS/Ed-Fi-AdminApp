import { FormControl, FormLabel, Switch, useBoolean, usePanGesture } from '@chakra-ui/react';
import { GetSbeDto, regarding } from '@edanalytics/models';
import { useEffect } from 'react';
import { RegisterSbeAdminApiAuto } from './RegisterSbeAdminApiAuto';
import { RegisterSbeAdminApiManual } from './RegisterSbeAdminApiManual';
import { usePopBanner } from '../../Layout/FeedbackBanner';
import { StatusType } from '@edanalytics/utils';
import { useSbeCheckAdminAPI } from '../../api';

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
