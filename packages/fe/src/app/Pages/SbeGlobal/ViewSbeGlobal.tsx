import { Attribute, AttributesGrid, ContentSection } from '@edanalytics/common-ui';
import { GetSbeDto } from '@edanalytics/models';
import { AuthorizeComponent } from '../../helpers';
import { SbeSyncQueue } from './SbeSyncQueue';

export const ViewSbeGlobal = (props: { sbe: GetSbeDto }) => {
  const { sbe } = props;
  return (
    <>
      <ContentSection>
        <AttributesGrid>
          <Attribute isCopyable label="Environment label" value={sbe.envLabel} />
          <Attribute isCopyable label="Ed-Fi hostname" value={sbe.configPublic?.edfiHostname} />
          <Attribute label="Created" value={sbe.created} isDate />
          <Attribute
            label="Last successful connection to Starting Blocks"
            value={sbe.configPublic?.lastSuccessfulConnectionSbMeta}
            isDate
          />
          <Attribute
            label="Last failed connection to Starting Blocks"
            value={sbe.configPublic?.lastFailedConnectionSbMeta}
            isDate
          />
          <Attribute
            label="Last successful connection to Ed-Fi Admin API"
            value={sbe.configPublic?.lastSuccessfulConnectionAdminApi}
            isDate
          />
          <Attribute
            label="Last failed connection to Ed-Fi Admin API"
            value={sbe.configPublic?.lastFailedConnectionAdminApi}
            isDate
          />
          <Attribute
            label="Last successful sync with Starting Blocks"
            value={sbe.configPublic?.lastSuccessfulPull}
            isDate
          />
          <Attribute
            label="Last failed sync with Starting Blocks"
            value={sbe.configPublic?.lastFailedPull}
            isDate
          />
          <Attribute
            isCopyable
            isUrl
            isUrlExternal
            label="Admin API URL"
            value={sbe.configPublic?.adminApiUrl}
          />
          <Attribute
            isMasked
            isCopyable
            label="Admin API key (not secret)"
            value={sbe.configPublic?.adminApiKey}
          />
          <Attribute
            isCopyable
            label="Admin API client name"
            value={sbe.configPublic?.adminApiClientDisplayName}
          />
          <Attribute isCopyable label="SB metadata ARN" value={sbe.configPublic?.sbeMetaArn} />
          {sbe.configPublic?.sbeMetaKey ? (
            <Attribute
              isCopyable
              isMasked
              label="SB metadata key (not secret)"
              value={sbe.configPublic?.sbeMetaKey}
            />
          ) : null}
        </AttributesGrid>
      </ContentSection>
      <AuthorizeComponent
        config={{
          privilege: 'sb-sync-queue:read',
          subject: {
            id: '__filtered__',
          },
        }}
      >
        <SbeSyncQueue sbe={sbe} />
      </AuthorizeComponent>
    </>
  );
};
