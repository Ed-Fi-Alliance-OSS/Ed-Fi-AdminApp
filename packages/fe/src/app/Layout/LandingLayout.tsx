import { Box, Divider, Image, Text, VStack } from '@chakra-ui/react';
import { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import logoUrl from '../../assets/starting-blocks.svg';
import bgUrl from '../../assets/starting-blocks-no-text.svg';

export const LandingLayoutRouteElement = () => (
  <LandingLayout>
    <Outlet />
  </LandingLayout>
);

export const LandingLayout = (props: { children: ReactNode }) => {
  return (
    <VStack
      css={{
        '&::before': {
          content: '""',
          position: 'absolute',
          filter: 'saturate(0)',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          opacity: '0.1',
          background: `url(${bgUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          zIndex: '-1',
        },
      }}
      gap={14}
      p="3em"
      justify="flex-end"
      flex="1 1 100%"
      h="100%"
    >
      <Box filter={'drop-shadow(13px 13px 15px rgba(0,0,0,0.15))'}>
        <Image display="inline" src={logoUrl} />
        <Text
          fontWeight={600}
          fontSize="5xl"
          ml="0.2em"
          color="gray.600"
          verticalAlign="top"
          as="span"
          fontFamily="mono"
          lineHeight={0.4}
        >
          Admin App
        </Text>
      </Box>
      <Divider borderColor="gray.500" w="40%" />
      <Box flex="0.6 1 0%">{props.children}</Box>
      <Box fontSize="sm" color="gray.600" textAlign="center">
        ©2023 Education Analytics, Inc. All Rights Reserved
      </Box>
    </VStack>
  );
};
