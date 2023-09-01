import {
  Accordion,
  Box,
  Card,
  CardBody,
  CardHeader,
  HStack,
  Heading,
  StackDivider,
  Text,
} from '@chakra-ui/react';
import { GetSbeDto } from '@edanalytics/models';
import { NavContextProvider } from '../../helpers';
import { useApplicationContent } from './useApplicationContent';
import { useEdorgContent } from './useEdorgContent';
import { useOdsContent } from './useOdsContent';

export const SbeCard = (props: { sbe: GetSbeDto }) => {
  const OdsContent = useOdsContent({ sbe: props.sbe });
  const EdorgContent = useEdorgContent({ sbe: props.sbe });
  const ApplicationContent = useApplicationContent({ sbe: props.sbe });

  return (
    <NavContextProvider sbeId={props.sbe.id}>
      <Card mb={8} w="fit-content" minWidth="55em" variant="elevated">
        <CardHeader pb={0}>
          <Heading color="gray.600" size="md">
            {props.sbe.displayName}
          </Heading>
        </CardHeader>
        <CardBody>
          <HStack alignItems="start" my={4} gap={4} divider={<StackDivider />}>
            <HStack flexGrow={5} spacing={10} alignItems="start">
              {OdsContent.Stat}
              {EdorgContent.Stat}
              {ApplicationContent.Stat}
            </HStack>
            <Box color="gray.500">
              <Text title={props.sbe.createdDetailed}>Created: {props.sbe.createdShort}</Text>
              <Text title={props.sbe.modifiedDetailed}>Updated: {props.sbe.modifiedShort}</Text>
              <Text title={props.sbe.configPublic?.lastSuccessfulPullLong}>
                Synced: {props.sbe.configPublic?.lastSuccessfulPullShort}
              </Text>
            </Box>
          </HStack>
          <Accordion mt={10} allowMultiple defaultIndex={[]}>
            {OdsContent.AccordionItem}
            {EdorgContent.AccordionItem}
            {ApplicationContent.AccordionItem}
          </Accordion>
        </CardBody>
      </Card>
    </NavContextProvider>
  );
};
