// Verify your identity (P18-TSK-014). The customer agrees to identity checks (the KYC_PROCESSING consent
// finapp requires), starts verification, and adds identity documents. Status is finapp's customer-shaped
// status only; no check, score or reason is ever shown (INV-RSK-08).
//
// What this page does not promise: finapp's verification checks are not run by anything in production yet
// (gap G-16), so a case stays "Started" however many documents are added. The page says documents were
// received and the review will follow - never a time, never a result it does not have.
import { Alert, Button, Card, FileInput, Select, Stack, Text, Title } from '@mantine/core';
import { IconCircleCheck, IconUpload } from '@tabler/icons-react';
import { useState, type FormEvent } from 'react';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { ErrorExplained, LoadingState, UnknownOutcome } from '../../design-system/States.tsx';
import { KYC_STATUS } from '../../design-system/status.ts';
import { StatusChip } from '../../design-system/Values.tsx';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { ConsentCard, useConsents } from './ConsentsPage.tsx';
import {
  checkFile,
  contentTypeOf,
  readBytes,
  toBase64,
  useKycCase,
  type DocumentType,
  type FileProblem,
} from './kyc.ts';

const messages = defineMessages({
  title: { id: 'kyc.title', defaultMessage: 'Verify your identity' },
  lead: {
    id: 'kyc.lead',
    defaultMessage: 'The law requires us to know who our customers are before they hold or move money.',
  },
  consentFirst: { id: 'kyc.consentFirst', defaultMessage: 'First, agree to us checking your identity.' },
  start: { id: 'kyc.start', defaultMessage: 'Start verification' },
  statusLabel: { id: 'kyc.status', defaultMessage: 'Status' },
  approved: { id: 'kyc.approved', defaultMessage: 'Your identity is verified. Thank you.' },
  rejected: {
    id: 'kyc.rejected',
    defaultMessage: 'We could not verify your identity. You can start again with new documents.',
  },
  startAgain: { id: 'kyc.startAgain', defaultMessage: 'Start again' },
  documentsTitle: { id: 'kyc.documents', defaultMessage: 'Add your documents' },
  documentsLead: {
    id: 'kyc.documents.lead',
    defaultMessage:
      'Add an identity document (both sides of an ID card) and a proof of address. Photos or scans, JPEG, PNG or PDF, up to 512 KB each.',
  },
  documentType: { id: 'kyc.documentType', defaultMessage: 'Document' },
  file: { id: 'kyc.file', defaultMessage: 'File' },
  upload: { id: 'kyc.upload', defaultMessage: 'Add document' },
  chooseType: { id: 'kyc.chooseType', defaultMessage: 'Choose which document this is.' },
  chooseFile: { id: 'kyc.chooseFile', defaultMessage: 'Choose a file.' },
  fileType: { id: 'kyc.file.type', defaultMessage: 'Use a JPEG, PNG or PDF file.' },
  fileEmpty: { id: 'kyc.file.empty', defaultMessage: 'This file is empty.' },
  fileLarge: { id: 'kyc.file.large', defaultMessage: 'This file is larger than 512 KB. Use a smaller photo or scan.' },
  received: { id: 'kyc.received', defaultMessage: 'Received during this visit' },
  receivedNote: {
    id: 'kyc.receivedNote',
    defaultMessage: 'We have your documents. We will review them and update your status here.',
  },
  PASSPORT: { id: 'kyc.doc.passport', defaultMessage: 'Passport' },
  ID_CARD_FRONT: { id: 'kyc.doc.idFront', defaultMessage: 'ID card - front' },
  ID_CARD_BACK: { id: 'kyc.doc.idBack', defaultMessage: 'ID card - back' },
  DRIVING_LICENCE: { id: 'kyc.doc.licence', defaultMessage: 'Driving licence' },
  PROOF_OF_ADDRESS: { id: 'kyc.doc.address', defaultMessage: 'Proof of address' },
});

const receivedItem = defineMessage<{ document: string }>({
  id: 'kyc.receivedItem',
  defaultMessage: '{document} - received',
});

const DOCUMENT_TYPES: readonly DocumentType[] = [
  'PASSPORT',
  'ID_CARD_FRONT',
  'ID_CARD_BACK',
  'DRIVING_LICENCE',
  'PROOF_OF_ADDRESS',
];

const FILE_PROBLEMS: Readonly<Record<FileProblem, keyof typeof messages>> = {
  type: 'fileType',
  empty: 'fileEmpty',
  'too-large': 'fileLarge',
};

function DocumentUpload() {
  const intl = useIntl();
  const api = useApi();
  const [documentType, setDocumentType] = useState<DocumentType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | undefined>();
  const [received, setReceived] = useState<DocumentType[]>([]);
  const upload = useCommand(
    async (intent: { body: { documentType: DocumentType; contentType: 'JPEG' | 'PNG' | 'PDF'; content: string } }) =>
      ok(api.POST('/v1/me/kyc/documents', { body: intent.body })),
    { invalidate: ['kyc'], routeId: '/onboarding/identity' },
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (documentType === null) return setProblem(intl.formatMessage(messages.chooseType));
    if (file === null) return setProblem(intl.formatMessage(messages.chooseFile));
    const fileProblem = checkFile(file);
    if (fileProblem !== undefined) return setProblem(intl.formatMessage(messages[FILE_PROBLEMS[fileProblem]]));
    const contentType = contentTypeOf(file.type);
    if (contentType === undefined) return setProblem(intl.formatMessage(messages.fileType));
    setProblem(undefined);
    const content = toBase64(await readBytes(file));
    const result = await upload.submit({ documentType, contentType, content });
    if (result?.status === 'succeeded') {
      setReceived((list) => [...list, documentType]);
      setFile(null);
      setDocumentType(null);
    }
  };

  const failure = failureOf(upload.state);
  return (
    <Card withBorder radius="md" padding="lg">
      <form onSubmit={(event) => void submit(event)} noValidate>
        <Stack>
          <Title order={2}>
            <FormattedMessage {...messages.documentsTitle} />
          </Title>
          <Text>
            <FormattedMessage {...messages.documentsLead} />
          </Text>
          <Select
            label={intl.formatMessage(messages.documentType)}
            data={DOCUMENT_TYPES.map((type) => ({ value: type, label: intl.formatMessage(messages[type]) }))}
            value={documentType}
            onChange={(value) => setDocumentType(value as DocumentType | null)}
            comboboxProps={{ withinPortal: false }}
          />
          <FileInput
            label={intl.formatMessage(messages.file)}
            accept="image/jpeg,image/png,application/pdf"
            value={file}
            onChange={setFile}
            leftSection={<IconUpload size={18} aria-hidden />}
            clearable
          />
          {problem === undefined ? null : (
            <Text c="red" role="alert">
              {problem}
            </Text>
          )}
          {failure === undefined ? null : failure.status === 'unknown' ? (
            <UnknownOutcome correlationId={failure.error.correlationId} />
          ) : (
            <ErrorExplained error={failure.error} />
          )}
          <div>
            <Button type="submit" loading={upload.state.status === 'sending'}>
              <FormattedMessage {...messages.upload} />
            </Button>
          </div>
          {received.length === 0 ? null : (
            <Alert
              color="teal"
              variant="light"
              icon={<IconCircleCheck aria-hidden />}
              title={intl.formatMessage(messages.received)}
            >
              <Stack gap={4}>
                {received.map((type, index) => (
                  <Text key={`${type}-${index}`}>
                    {intl.formatMessage(receivedItem, { document: intl.formatMessage(messages[type]) })}
                  </Text>
                ))}
                <Text size="sm">
                  <FormattedMessage {...messages.receivedNote} />
                </Text>
              </Stack>
            </Alert>
          )}
        </Stack>
      </form>
    </Card>
  );
}

export function KycPage() {
  const intl = useIntl();
  const api = useApi();
  const kyc = useKycCase();
  const consents = useConsents();
  const start = useCommand(async () => ok(api.POST('/v1/me/kyc')), {
    invalidate: ['kyc'],
    routeId: '/onboarding/identity',
  });

  if (kyc.isPending || consents.isPending) return <LoadingState />;
  if (kyc.isError) return <ErrorExplained error={kyc.error} onRetry={() => void kyc.refetch()} />;
  if (consents.isError) return <ErrorExplained error={consents.error} onRetry={() => void consents.refetch()} />;

  const consent = consents.data.find((c) => c.purpose === 'KYC_PROCESSING');
  const consented = consent?.granted === true;
  const status = kyc.data.exists ? kyc.data.status : undefined;
  const decided = status === 'APPROVED' || status === 'REJECTED';
  const open = status !== undefined && !decided;
  const startFailure = failureOf(start.state);

  return (
    <Stack gap="lg" maw={640}>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      <Text>
        <FormattedMessage {...messages.lead} />
      </Text>
      {status === undefined ? null : (
        <Stack gap={4} align="flex-start">
          <Text size="sm" c="dimmed">
            <FormattedMessage {...messages.statusLabel} />
          </Text>
          <StatusChip value={status} map={KYC_STATUS} />
        </Stack>
      )}
      {status === 'APPROVED' ? (
        <Alert color="teal" variant="light" icon={<IconCircleCheck aria-hidden />}>
          <FormattedMessage {...messages.approved} />
        </Alert>
      ) : null}
      {status === 'REJECTED' ? (
        <Alert color="gray" variant="light">
          <FormattedMessage {...messages.rejected} />
        </Alert>
      ) : null}
      {!consented && consent !== undefined && !open ? (
        <Stack>
          <Text fw={600}>
            <FormattedMessage {...messages.consentFirst} />
          </Text>
          <ConsentCard consent={consent} />
        </Stack>
      ) : null}
      {startFailure === undefined ? null : <ErrorExplained error={startFailure.error} />}
      {!open && consented && status !== 'APPROVED' ? (
        <div>
          <Button onClick={() => void start.submit({})} loading={start.state.status === 'sending'}>
            {intl.formatMessage(status === 'REJECTED' ? messages.startAgain : messages.start)}
          </Button>
        </div>
      ) : null}
      {open ? <DocumentUpload /> : null}
    </Stack>
  );
}
