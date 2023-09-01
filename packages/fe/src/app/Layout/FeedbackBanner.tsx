import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  CloseButton,
} from '@chakra-ui/react';
import {
  IWorkflowFailureErrors,
  OperationResult,
  StatusType,
  stdDetailed,
} from '@edanalytics/utils';
import _ from 'lodash';
import { ReactNode, createContext, useContext, useState } from 'react';

type BannerState = Record<number, IWorkflowFailureErrors>;

const FeedbackBannerContext = createContext<{
  banners: BannerState;
  setBanners: React.Dispatch<React.SetStateAction<BannerState>>;
}>({
  banners: [],
  setBanners: () => undefined,
});

export const FeedbackBannerProvider = (props: { children: ReactNode }) => {
  const [banners, setBanners] = useState<BannerState>({});
  return (
    <FeedbackBannerContext.Provider value={{ banners, setBanners }}>
      {props.children}
    </FeedbackBannerContext.Provider>
  );
};

export const useBannerContext = () => useContext(FeedbackBannerContext);

export const usePopBanner = () => {
  const { setBanners } = useContext(FeedbackBannerContext);
  const popBanner = (banner: IWorkflowFailureErrors) => {
    const timestamp = Number(new Date());
    setBanners((old) => ({
      ...old,
      [timestamp]: banner,
    }));
  };
  return popBanner;
};

export const StatusBadge = ({
  status,
  pastTense,
}: {
  status: OperationResult;
  pastTense?: boolean;
}) => (
  <Badge colorScheme={status === OperationResult.success ? 'green' : 'red'}>
    {status === OperationResult.success
      ? pastTense
        ? 'Succeeded'
        : 'Success'
      : pastTense
      ? 'Failed'
      : 'Failure'}
  </Badge>
);

export const FeedbackBanners = () => {
  const { banners, setBanners } = useBannerContext();

  const onRemove = (key: string) => () => setBanners((value) => _.omit(value, key));

  return (
    <Box>
      {_.sortBy(Object.entries(banners), 0).map(([id, banner], i) => (
        <Alert
          key={id}
          title={`${stdDetailed(new Date(Number(id)))}${
            banner.regarding ? ` - ${banner.regarding}` : ''
          }`}
          py={1}
          borderColor={
            banner.status === StatusType.error
              ? 'red.200'
              : banner.status === StatusType.warning
              ? 'orange.200'
              : banner.status === StatusType.success
              ? 'green.200'
              : 'blue.200'
          }
          borderBottomWidth="1px"
          borderBottomStyle="solid"
          status={
            banner.status === StatusType.error
              ? 'error'
              : banner.status === StatusType.warning
              ? 'warning'
              : banner.status === StatusType.success
              ? 'success'
              : 'info'
          }
        >
          <AlertIcon />
          <AlertTitle>{banner.title}</AlertTitle>
          <AlertDescription flexGrow={1}>{banner.message || null}</AlertDescription>
          <CloseButton onClick={onRemove(id)} />
        </Alert>
      ))}
    </Box>
  );
};
