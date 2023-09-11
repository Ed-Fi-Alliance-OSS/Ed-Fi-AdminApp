import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  CloseButton,
  HStack,
} from '@chakra-ui/react';
import {
  IWorkflowFailureErrors,
  OperationResult,
  StatusType,
  stdDetailed,
} from '@edanalytics/utils';
import omit from 'lodash/omit';
import sortBy from 'lodash/sortBy';
import { ReactNode, createContext, useContext, useMemo, useState } from 'react';

type BannerItem =
  | IWorkflowFailureErrors
  | ((props: { onDelete: () => void }) => IWorkflowFailureErrors);

type BannerState = Record<number, BannerItem>;

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
  const popBanner = useMemo(
    () => (banner: BannerItem) => {
      const timestamp = Number(new Date());
      setBanners((old) => ({
        ...old,
        [timestamp]: banner,
      }));
    },
    [setBanners]
  );
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

  const onRemove = (key: string) => () => setBanners((value) => omit(value, key));

  return (
    <Box>
      {sortBy(Object.entries(banners), 0).map(([id, banner], i) => {
        const bannerValue =
          typeof banner === 'function' ? banner({ onDelete: onRemove(id) }) : banner;
        return (
          <Alert
            key={id}
            title={`${stdDetailed(new Date(Number(id)))}${
              bannerValue.regarding ? ` - ${bannerValue.regarding}` : ''
            }`}
            py={1}
            borderColor={
              bannerValue.status === StatusType.error
                ? 'red.200'
                : bannerValue.status === StatusType.warning
                ? 'orange.200'
                : bannerValue.status === StatusType.success
                ? 'green.200'
                : 'blue.200'
            }
            borderBottomWidth="1px"
            borderBottomStyle="solid"
            status={
              bannerValue.status === StatusType.error
                ? 'error'
                : bannerValue.status === StatusType.warning
                ? 'warning'
                : bannerValue.status === StatusType.success
                ? 'success'
                : 'info'
            }
          >
            <AlertIcon />
            <HStack flexGrow={1} alignItems="baseline">
              <AlertTitle>{bannerValue.title}</AlertTitle>
              <AlertDescription>{bannerValue.message || null}</AlertDescription>
            </HStack>
            <CloseButton onClick={onRemove(id)} />
          </Alert>
        );
      })}
    </Box>
  );
};
