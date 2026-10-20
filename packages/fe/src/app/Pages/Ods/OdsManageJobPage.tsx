import { Alert, AlertDescription, AlertIcon, Badge, Text } from '@chakra-ui/react';
import {
  Attribute,
  AttributeContainer,
  AttributesGrid,
  ContentSection,
  PageTemplate,
} from '@edanalytics/common-ui';
import { OdsManageJobData } from '@edanalytics/models';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { odsManageJobQueries } from '../../api';
import { useOdsTerminology } from '../../helpers';
import { jobStateColorSchemes, syncQueueRefetchInterval } from '../SbSyncQueue/syncQueueStates';

const failureStates = ['failed', 'cancelled', 'expired'];

/** Admin API's error message, verbatim, is stored as `output.message` on the job. */
const getOutputMessage = (output: unknown): string | undefined =>
  output && typeof output === 'object' && 'message' in output
    ? String((output as { message: unknown }).message)
    : undefined;

/**
 * Shows the outcome of a datastore create/delete. Auto-refreshes until the job reaches a
 * terminal state.
 */
export const OdsManageJobPage = () => {
  const { asId, edfiTenantId, operation, jobId } = useParams() as {
    asId: string;
    edfiTenantId: string;
    operation: string;
    jobId: string;
  };
  const terminology = useOdsTerminology();
  const job = useQuery(
    odsManageJobQueries.getOne({
      teamId: asId,
      edfiTenantId,
      operation,
      jobId,
      refetchInterval: syncQueueRefetchInterval,
    })
  );
  const title = `${terminology.singular} ${operation === 'delete' ? 'deletion' : 'creation'}`;

  if (job.isError) {
    return (
      <PageTemplate title={title} actions={undefined}>
        <Text>This job is no longer available.</Text>
      </PageTemplate>
    );
  }
  if (!job.data) {
    return (
      <PageTemplate title={title} actions={undefined}>
        {null}
      </PageTemplate>
    );
  }

  const data = job.data;
  const jobData = data.data as OdsManageJobData;
  const errorMessage = failureStates.includes(data.state)
    ? getOutputMessage(data.output) ?? `The ${terminology.singular} ${operation} did not complete.`
    : undefined;

  return (
    <PageTemplate title={title} actions={undefined}>
      <ContentSection>
        <AttributesGrid>
          <Attribute label={`${terminology.singular} name`} value={jobData.odsName} />
          <Attribute label="Operation" value={operation} />
          <AttributeContainer label="State">
            <Badge colorScheme={jobStateColorSchemes[data.state]}>{data.state}</Badge>
          </AttributeContainer>
          <Attribute label="Created" isDate value={data.createdon} />
          <Attribute label="Completed" isDate value={data.completedon} />
        </AttributesGrid>
      </ContentSection>
      {errorMessage ? (
        <Alert status="error" mt={4} alignItems="flex-start">
          <AlertIcon />
          <AlertDescription whiteSpace="pre-wrap">{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </PageTemplate>
  );
};
