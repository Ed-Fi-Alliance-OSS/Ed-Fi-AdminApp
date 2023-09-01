import { Badge, chakra } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
} from '@edanalytics/common-ui';
import { useParams } from 'react-router-dom';
import { sbSyncQueueQueries, sbeQueries } from '../../api';
import { SbeGlobalLink } from '../../routes';
import { jobStateColorSchemes } from './SbSyncQueuesPage';

export const ViewSbSyncQueue = () => {
  const params = useParams() as { sbSyncQueueId: string };
  const sbSyncQueue = sbSyncQueueQueries.useOne({
    id: params.sbSyncQueueId,
  }).data;
  const sbes = sbeQueries.useAll({});

  const output = sbSyncQueue?.output ?? null;
  const stack =
    sbSyncQueue?.output && 'stack' in sbSyncQueue.output ? sbSyncQueue.output.stack ?? null : null;

  return sbSyncQueue ? (
    <>
      <ContentSection>
        <AttributesGrid>
          <Attribute label="Name" value={sbSyncQueue.name} />
          <AttributeContainer label="Environment">
            <SbeGlobalLink query={sbes} id={sbSyncQueue.sbeId} />
          </AttributeContainer>
          <Attribute label="Created" isDate value={sbSyncQueue.createdon} />
          <Attribute label="Completed" isDate value={sbSyncQueue.completedon} />
          <Attribute label="Duration" value={sbSyncQueue.durationDetailed} />
          <AttributeContainer label="State">
            <Badge colorScheme={jobStateColorSchemes[sbSyncQueue.state]}>{sbSyncQueue.state}</Badge>
          </AttributeContainer>
        </AttributesGrid>
      </ContentSection>
      <ContentSection heading="Output">
        {output ? (
          <chakra.pre whiteSpace="break-spaces">{JSON.stringify(output, null, 2)}</chakra.pre>
        ) : null}
      </ContentSection>
      {stack ? (
        <ContentSection heading="Stack trace">
          <chakra.pre whiteSpace="break-spaces">{stack as string}</chakra.pre>
        </ContentSection>
      ) : null}
    </>
  ) : null;
};
