import { Text } from '@chakra-ui/react';
import { useSearchParamsObject } from '../helpers/useSearch';

export const UnauthenticatedPage = () => {
  const search = useSearchParamsObject();
  return (
    <Text p="1em" fontSize="2xl" fontWeight={500} color="gray.700" textAlign="center" maxW="30em">
      {'msg' in search
        ? search.msg
        : 'It looks like your login was not successful. Please try again and contact us if the issue persists.'}
    </Text>
  );
};
