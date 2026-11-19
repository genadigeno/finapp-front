// Your business (P18-TSK-015). A signed-in person registers one organisation and becomes its only acting
// person (finapp has no members or mandates yet - G-09). Registering opens the business's verification
// (KYB); the registrant then declares who owns or controls it.
//
// An owner is named by their customer reference (their party id). finapp offers no search for another
// person, so an owner shares their reference with the registrant - shown to every customer on Home - and the
// registrant can declare themselves with their own. The owner must have a FinApp account and have started
// verifying their identity; finapp says so when they have not.
import { Alert, Button, Card, Group, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { defineMessage, defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { z } from 'zod';
import { formatInstant } from '../../design-system/dates.ts';
import { basisPointsToPercent, percentToBasisPoints } from '../../design-system/money.ts';
import { ErrorExplained, LoadingState } from '../../design-system/States.tsx';
import { KYC_STATUS } from '../../design-system/status.ts';
import { StatusChip } from '../../design-system/Values.tsx';
import { ScrollableTable } from '../../design-system/ScrollableTable.tsx';
import { ApiError } from '../../platform/api/api-error.ts';
import { useApi } from '../../platform/api/api-context.tsx';
import { ok } from '../../platform/api/client.ts';
import { failureOf, useCommand } from '../../platform/api/use-command.ts';
import { zodResolver } from '../../platform/forms/zod-resolver.ts';
import { useStanding } from '../../platform/session/standing.ts';

export const KYB_QUERY = ['kyb'] as const;

type ControlRole = 'DIRECTOR' | 'SENIOR_MANAGING_OFFICIAL' | 'TRUSTEE';
const CONTROL_ROLES: readonly ControlRole[] = ['DIRECTOR', 'SENIOR_MANAGING_OFFICIAL', 'TRUSTEE'];

const messages = defineMessages({
  title: { id: 'business.title', defaultMessage: 'Your business' },
  registerLead: {
    id: 'business.register.lead',
    defaultMessage:
      'Register the business you act for. You will be its contact with us, and we will verify the business and the people who own or control it.',
  },
  name: { id: 'business.name', defaultMessage: 'Registered name of the business' },
  nameRequired: { id: 'business.name.required', defaultMessage: 'Enter the business name.' },
  register: { id: 'business.register', defaultMessage: 'Register business' },
  verification: { id: 'business.verification', defaultMessage: 'Business verification' },
  owners: { id: 'business.owners', defaultMessage: 'Owners and controllers' },
  noOwners: { id: 'business.noOwners', defaultMessage: 'No one has been declared yet.' },
  reference: { id: 'business.reference', defaultMessage: 'Customer reference' },
  share: { id: 'business.share', defaultMessage: 'Share' },
  role: { id: 'business.role', defaultMessage: 'Role' },
  declared: { id: 'business.declared', defaultMessage: 'Declared' },
  pending: { id: 'business.pending', defaultMessage: 'Identity check pending' },
  declareTitle: { id: 'business.declare.title', defaultMessage: 'Declare an owner or controller' },
  declareLead: {
    id: 'business.declare.lead',
    defaultMessage:
      'Declare everyone who owns part of the business or controls it. Ask each person for their customer reference - they find it on their FinApp home page.',
  },
  yourReference: { id: 'business.yourReference', defaultMessage: 'Your own customer reference' },
  useMine: { id: 'business.useMine', defaultMessage: 'Declare myself' },
  ownerReference: { id: 'business.ownerReference', defaultMessage: "The person's customer reference" },
  referenceInvalid: {
    id: 'business.reference.invalid',
    defaultMessage: 'A customer reference looks like 0190a3c1-1111-7222-8333-444455556666.',
  },
  stake: { id: 'business.stake', defaultMessage: 'Share they own (%)' },
  stakeHint: {
    id: 'business.stake.hint',
    defaultMessage: 'Leave empty if they control the business without owning it.',
  },
  stakeInvalid: {
    id: 'business.stake.invalid',
    defaultMessage: 'Enter a share between 0.01 and 100, at most two decimals.',
  },
  controlRole: { id: 'business.controlRole', defaultMessage: 'Control role' },
  needOne: { id: 'business.needOne', defaultMessage: 'Enter a share, a control role, or both.' },
  declare: { id: 'business.declare', defaultMessage: 'Declare' },
  declaredOk: { id: 'business.declaredOk', defaultMessage: 'Declared. They will appear in the list below.' },
  noRole: { id: 'business.noRole', defaultMessage: 'None' },
  DIRECTOR: { id: 'business.role.director', defaultMessage: 'Director' },
  SENIOR_MANAGING_OFFICIAL: { id: 'business.role.smo', defaultMessage: 'Senior managing official' },
  TRUSTEE: { id: 'business.role.trustee', defaultMessage: 'Trustee' },
});

const percentMessage = defineMessage<{ percent: string }>({ id: 'business.percent', defaultMessage: '{percent}%' });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Owner {
  ownerPartyId: string;
  stakeBasisPoints: number | undefined;
  controlRole: string | undefined;
  declaredAt: string | undefined;
  verificationPending: boolean;
}

type Kyb = { exists: false } | { exists: true; status: string; owners: Owner[] };

function useKyb() {
  const api = useApi();
  return useQuery({
    queryKey: KYB_QUERY,
    queryFn: async (): Promise<Kyb> => {
      try {
        const { data } = await ok(api.GET('/v1/me/kyb'));
        return {
          exists: true,
          status: data.status ?? 'UNKNOWN',
          owners: (data.owners ?? []).flatMap((o) =>
            o.ownerPartyId === undefined
              ? []
              : [
                  {
                    ownerPartyId: o.ownerPartyId,
                    stakeBasisPoints: o.stakeBasisPoints,
                    controlRole: o.controlRole,
                    declaredAt: o.declaredAt,
                    verificationPending: o.verificationPending === true,
                  },
                ],
          ),
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return { exists: false };
        throw error;
      }
    },
  });
}

function roleLabel(role: string | undefined, intl: ReturnType<typeof useIntl>): string {
  return role !== undefined && (CONTROL_ROLES as readonly string[]).includes(role)
    ? intl.formatMessage(messages[role as ControlRole])
    : intl.formatMessage(messages.noRole);
}

function RegisterBusiness() {
  const intl = useIntl();
  const api = useApi();
  const schema = z.object({
    name: z
      .string()
      .trim()
      .min(1, intl.formatMessage(messages.nameRequired))
      .max(200)
      .regex(/^[^\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]+$/u),
  });
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: '' } });
  const register = useCommand(
    async (intent: { body: { name: string } }) => ok(api.POST('/v1/me/organisations', { body: intent.body })),
    { invalidate: ['kyb', 'me'], routeId: '/business' },
  );
  const failure = failureOf(register.state);
  return (
    <form onSubmit={(event) => void form.handleSubmit(({ name }) => register.submit({ name }))(event)} noValidate>
      <Stack>
        <Text>
          <FormattedMessage {...messages.registerLead} />
        </Text>
        {failure === undefined ? null : <ErrorExplained error={failure.error} />}
        <TextInput
          label={intl.formatMessage(messages.name)}
          autoComplete="organization"
          error={form.formState.errors.name?.message}
          {...form.register('name')}
        />
        <div>
          <Button type="submit" loading={register.state.status === 'sending'}>
            <FormattedMessage {...messages.register} />
          </Button>
        </div>
      </Stack>
    </form>
  );
}

function DeclareOwner({ ownReference }: { ownReference: string | undefined }) {
  const intl = useIntl();
  const api = useApi();
  const [declared, setDeclared] = useState(false);
  const schema = z
    .object({
      ownerPartyId: z.string().trim().regex(UUID, intl.formatMessage(messages.referenceInvalid)),
      stake: z
        .string()
        .trim()
        .refine((v) => {
          if (v === '') return true;
          const bp = percentToBasisPoints(v);
          return bp !== undefined && Number.parseInt(bp, 10) >= 1 && Number.parseInt(bp, 10) <= 10_000;
        }, intl.formatMessage(messages.stakeInvalid)),
      controlRole: z.string(),
    })
    .refine((v) => v.stake.trim() !== '' || v.controlRole !== '', {
      path: ['stake'],
      message: intl.formatMessage(messages.needOne),
    });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { ownerPartyId: '', stake: '', controlRole: '' },
  });
  const declare = useCommand(
    async (intent: { body: { ownerPartyId: string; stakeBasisPoints?: number; controlRole?: ControlRole } }) =>
      ok(api.POST('/v1/me/kyb/owners', { body: intent.body })),
    { invalidate: ['kyb'], routeId: '/business' },
  );
  const failure = failureOf(declare.state);
  const controlRole = useWatch({ control: form.control, name: 'controlRole' });

  const onSubmit = form.handleSubmit(async ({ ownerPartyId, stake, controlRole }) => {
    setDeclared(false);
    const bp = stake.trim() === '' ? undefined : percentToBasisPoints(stake);
    const result = await declare.submit({
      ownerPartyId: ownerPartyId.toLowerCase(),
      ...(bp === undefined ? {} : { stakeBasisPoints: Number.parseInt(bp, 10) }),
      ...(controlRole === '' ? {} : { controlRole: controlRole as ControlRole }),
    });
    if (result?.status === 'succeeded') {
      form.reset();
      setDeclared(true);
    }
  });

  return (
    <Card withBorder radius="md" padding="lg">
      <form onSubmit={(event) => void onSubmit(event)} noValidate>
        <Stack>
          <Title order={2}>
            <FormattedMessage {...messages.declareTitle} />
          </Title>
          <Text>
            <FormattedMessage {...messages.declareLead} />
          </Text>
          {ownReference === undefined ? null : (
            <Group gap="xs" wrap="wrap">
              <Text size="sm">
                <FormattedMessage {...messages.yourReference} />: <span className="finapp-mono">{ownReference}</span>
              </Text>
              <Button
                variant="subtle"
                onClick={() => form.setValue('ownerPartyId', ownReference, { shouldValidate: true })}
              >
                <FormattedMessage {...messages.useMine} />
              </Button>
            </Group>
          )}
          <TextInput
            label={intl.formatMessage(messages.ownerReference)}
            autoComplete="off"
            spellCheck={false}
            error={form.formState.errors.ownerPartyId?.message}
            {...form.register('ownerPartyId')}
          />
          <TextInput
            label={intl.formatMessage(messages.stake)}
            description={intl.formatMessage(messages.stakeHint)}
            inputMode="decimal"
            autoComplete="off"
            error={form.formState.errors.stake?.message}
            {...form.register('stake')}
          />
          <Select
            label={intl.formatMessage(messages.controlRole)}
            data={[
              { value: '', label: intl.formatMessage(messages.noRole) },
              ...CONTROL_ROLES.map((role) => ({ value: role, label: intl.formatMessage(messages[role]) })),
            ]}
            value={controlRole}
            onChange={(value) => form.setValue('controlRole', value ?? '')}
            allowDeselect={false}
            comboboxProps={{ withinPortal: false }}
          />
          {failure === undefined ? null : <ErrorExplained error={failure.error} />}
          {declared ? (
            <Text c="teal" role="status">
              <FormattedMessage {...messages.declaredOk} />
            </Text>
          ) : null}
          <div>
            <Button type="submit" loading={declare.state.status === 'sending'}>
              <FormattedMessage {...messages.declare} />
            </Button>
          </div>
        </Stack>
      </form>
    </Card>
  );
}

export function BusinessPage() {
  const intl = useIntl();
  const kyb = useKyb();
  const standing = useStanding();
  if (kyb.isPending) return <LoadingState />;
  if (kyb.isError) return <ErrorExplained error={kyb.error} onRetry={() => void kyb.refetch()} />;

  return (
    <Stack gap="lg" maw={720}>
      <Title order={1}>
        <FormattedMessage {...messages.title} />
      </Title>
      {!kyb.data.exists ? (
        <RegisterBusiness />
      ) : (
        <>
          <Stack gap={4} align="flex-start">
            <Text size="sm" c="dimmed">
              <FormattedMessage {...messages.verification} />
            </Text>
            <StatusChip value={kyb.data.status} map={KYC_STATUS} />
          </Stack>
          <Title order={2}>
            <FormattedMessage {...messages.owners} />
          </Title>
          {kyb.data.owners.length === 0 ? (
            <Alert variant="light" color="gray">
              <FormattedMessage {...messages.noOwners} />
            </Alert>
          ) : (
            <ScrollableTable label={intl.formatMessage(messages.owners)}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>
                      <FormattedMessage {...messages.reference} />
                    </Table.Th>
                    <Table.Th>
                      <FormattedMessage {...messages.share} />
                    </Table.Th>
                    <Table.Th>
                      <FormattedMessage {...messages.role} />
                    </Table.Th>
                    <Table.Th>
                      <FormattedMessage {...messages.declared} />
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {kyb.data.owners.map((owner) => {
                    const percent =
                      owner.stakeBasisPoints === undefined
                        ? undefined
                        : basisPointsToPercent(String(owner.stakeBasisPoints));
                    const at =
                      owner.declaredAt === undefined ? undefined : formatInstant(owner.declaredAt, intl.locale);
                    return (
                      <Table.Tr key={owner.ownerPartyId}>
                        <Table.Td className="finapp-mono">{owner.ownerPartyId}</Table.Td>
                        <Table.Td>
                          {percent === undefined ? '-' : intl.formatMessage(percentMessage, { percent })}
                        </Table.Td>
                        <Table.Td>{roleLabel(owner.controlRole, intl)}</Table.Td>
                        <Table.Td>
                          {at === undefined ? '-' : at.valid ? at.text : at.raw}
                          {owner.verificationPending ? (
                            <Text size="xs" c="dimmed">
                              <FormattedMessage {...messages.pending} />
                            </Text>
                          ) : null}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollableTable>
          )}
          <DeclareOwner ownReference={standing.data?.partyId} />
        </>
      )}
    </Stack>
  );
}
