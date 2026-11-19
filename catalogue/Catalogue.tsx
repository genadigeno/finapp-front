// The component catalogue (P18-TSK-007): every design-system component, with representative props, on
// one page - built for production and served with the real CSP, so axe and the browser judge what
// customers will get.
//
// These values are DEMONSTRATION props for a test page - never product data. The catalogue is a separate
// build (vite.catalogue.config.ts) and never part of the application's bundle.
import {
  Button,
  Card,
  Checkbox,
  FileInput,
  Group,
  List,
  PasswordInput,
  Radio,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowsExchange,
  IconClock,
  IconCreditCard,
  IconHome,
  IconShieldLock,
  IconWallet,
} from '@tabler/icons-react';
import { useState } from 'react';
import { ApiError } from '../src/platform/api/api-error.ts';
import {
  BalanceTriplet,
  BusinessDate,
  ConfirmDangerous,
  CorrelationReference,
  Countdown,
  CROSS_BORDER_STATUS,
  CustomerShell,
  EmptyState,
  ErrorExplained,
  FeatureUnavailable,
  KYC_STATUS,
  LoadingState,
  Money,
  MoneyInput,
  parseMoneyInput,
  Rate,
  SignedMoney,
  ResultPanel,
  ReviewPanel,
  SessionExpiring,
  StatusChip,
  StepUpDialog,
  TextButton,
  Timestamp,
  TRANSFER_STATUS,
  UnknownOutcome,
  WITHDRAWAL_STATUS,
  Wizard,
  type NavItem,
  type ParsedMoneyInput,
} from '../src/design-system/index.ts';
import { PocketSelect } from '../src/design-system/PocketSelect.tsx';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const CORRELATION = '0190a3c1-1111-7222-8333-444455556666';

const NAVIGATION: NavItem[] = [
  { label: 'Home', href: '#home', icon: IconHome, active: true },
  { label: 'Accounts', href: '#accounts', icon: IconWallet },
  { label: 'Move money', href: '#move', icon: IconArrowsExchange },
  { label: 'Credit', href: '#credit', icon: IconCreditCard },
  { label: 'Activity', href: '#activity', icon: IconClock },
  { label: 'Business', href: '#business', icon: IconWallet },
  { label: 'Security', href: '#security', icon: IconShieldLock },
];

const STALE = new ApiError({
  kind: 'problem',
  method: 'POST',
  route: '/v1/me/fx/conversions',
  status: 409,
  code: 'fx.QuoteExpired',
  correlationId: CORRELATION,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card withBorder padding="lg" radius="md" component="section" aria-label={title}>
      <Stack gap="md">
        <Title order={2}>{title}</Title>
        {children}
      </Stack>
    </Card>
  );
}

export function Catalogue() {
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [amount, setAmount] = useState('1,250.505');
  const [parsed, setParsed] = useState<ParsedMoneyInput | undefined>(undefined);

  return (
    <CustomerShell
      navigation={NAVIGATION}
      account={<TextButton onClick={() => undefined}>Sign out</TextButton>}
      banner={<SessionExpiring remainingMs={95_000} onStay={() => undefined} />}
    >
      <Stack gap="xl">
        <Title order={1}>Component catalogue</Title>

        <Section title="Money and rates">
          <Text>
            Euro: <Money amount="1234.5" currency="EUR" /> · Yen: <Money amount="98000" currency="JPY" /> · Dinar:{' '}
            <Money amount="12.125" currency="BHD" /> · Negative: <Money amount="-42.10" currency="GBP" /> · Unreadable:{' '}
            <Money amount="12,5" currency="EUR" />
          </Text>
          <Text>
            Large: <Money amount="12345678901234567890.12" currency="EUR" size="lg" />
          </Text>
          <Text>
            Rate: <Rate rate="1.08234" source="EUR" destination="USD" />
          </Text>
          <Text>
            Movements: <SignedMoney amount="250.00" currency="EUR" direction="in" /> ·{' '}
            <SignedMoney amount="42.10" currency="EUR" direction="out" />
          </Text>
          <BalanceTriplet
            currency="EUR"
            available="1180.25"
            settled="1250.25"
            holds="70.00"
            asOf="2026-11-19T12:00:00Z"
          />
        </Section>

        <Section title="Entering an amount">
          <MoneyInput
            label="Amount to send"
            description="Up to 2 decimals"
            value={amount}
            onChange={setAmount}
            currency="EUR"
            problem={parsed !== undefined && !parsed.ok ? parsed.problem : undefined}
          />
          <div>
            <Button variant="default" onClick={() => setParsed(parseMoneyInput(amount, 'EUR', 'en-GB'))}>
              Check amount
            </Button>
          </div>
        </Section>

        <Section title="Statuses">
          <Stack gap="xs" align="flex-start">
            <StatusChip value="COMPLETED" map={TRANSFER_STATUS} />
            <StatusChip value="INITIATED" map={TRANSFER_STATUS} />
            <StatusChip value="FAILED" map={TRANSFER_STATUS} />
            <StatusChip value="HELD" map={WITHDRAWAL_STATUS} />
            <StatusChip value="UNKNOWN" map={WITHDRAWAL_STATUS} />
            <StatusChip value="DELIVERED" map={CROSS_BORDER_STATUS} />
            <StatusChip value="PENDING_DECISION" map={KYC_STATUS} />
            <StatusChip value="SOMETHING_NEW" map={TRANSFER_STATUS} />
          </Stack>
        </Section>

        <Section title="Dates and time">
          <Text>
            Value date: <BusinessDate value="2026-11-20" /> · Created:{' '}
            <Timestamp value="2026-11-19T12:00:00Z" withZone />
          </Text>
          <Text>
            Quote: <Countdown expiresAt="2026-11-19T12:00:45Z" now={() => NOW} /> · Old quote:{' '}
            <Countdown expiresAt="2026-11-19T11:59:00Z" now={() => NOW} />
          </Text>
          <CorrelationReference correlationId={CORRELATION} />
        </Section>

        <Section title="States">
          <LoadingState rows={2} />
          <EmptyState title="No transfers yet">When you send money, it will appear here.</EmptyState>
          <ErrorExplained error={STALE} onRetry={() => undefined} />
          <FeatureUnavailable correlationId={CORRELATION} />
          <UnknownOutcome correlationId={CORRELATION} onCheck={() => undefined} onSendSame={() => undefined} />
        </Section>

        <Section title="Sending money">
          <Wizard steps={['Recipient', 'Amount', 'Review']} current={2}>
            <ReviewPanel
              title="Review your transfer"
              rows={[
                { label: 'To', value: 'Savings account' },
                { label: 'Amount', value: <Money amount="250.00" currency="EUR" />, emphasis: true },
                { label: 'Fee', value: <Money amount="0.00" currency="EUR" />, emphasis: true },
              ]}
              notice={<Text size="sm">Transfers between your own accounts arrive immediately.</Text>}
              onConfirm={() => undefined}
              onBack={() => undefined}
            />
          </Wizard>
          <ResultPanel kind="succeeded" title="Money sent" correlationId={CORRELATION}>
            €250.00 is on its way to Savings account.
          </ResultPanel>
          <ResultPanel kind="pending" title="Your payment is being processed">
            We will update the status here when the bank confirms it.
          </ResultPanel>
          <ResultPanel kind="refused" title="This could not be done">
            Nothing was changed.
          </ResultPanel>
          <ResultPanel kind="unknown" title="We are checking whether this went through" />
        </Section>

        <Section title="Onboarding controls">
          <PasswordInput label="Password" description="At least 8 characters." defaultValue="secret value" />
          <Select
            label="Document"
            data={[
              { value: 'PASSPORT', label: 'Passport' },
              { value: 'PROOF_OF_ADDRESS', label: 'Proof of address' },
            ]}
            comboboxProps={{ withinPortal: false }}
          />
          <FileInput label="File" accept="image/jpeg,image/png,application/pdf" placeholder="Choose a file" clearable />
          <List type="ordered">
            <List.Item>Open your authenticator app.</List.Item>
            <List.Item>Enter the setup key.</List.Item>
          </List>
          <Text className="finapp-secret">JBSW Y3DP EHPK 3PXP</Text>
          <div className="finapp-table-scroll">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Customer reference</Table.Th>
                  <Table.Th>Share</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td className="finapp-mono">0190a3c1-aaaa-7222-8333-444455556666</Table.Td>
                  <Table.Td>25.50%</Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </div>
          <a href="#identity" className="finapp-entry">
            <Card withBorder radius="md" padding="md">
              <div className="finapp-entry__row">
                <ThemeIcon variant="light" color="blue" radius="xl" size="lg">
                  <IconClock size={20} aria-hidden />
                </ThemeIcon>
                <Stack gap={2} className="finapp-entry__text">
                  <Text fw={600}>Verify your identity</Text>
                  <Text size="sm" c="dimmed">
                    We are reviewing your details.
                  </Text>
                </Stack>
              </div>
            </Card>
          </a>
        </Section>

        <Section title="Money movement controls">
          <PocketSelect
            label="Pay from"
            pockets={[
              { accountId: 'a1', currency: 'EUR', available: '1180.00' },
              { accountId: 'a1', currency: 'JPY', available: '98000' },
            ]}
            value={null}
            onChange={() => undefined}
          />
          <Radio.Group label="I know the amount I want to" defaultValue="FIXED_SOURCE">
            <Group mt="xs">
              <Radio value="FIXED_SOURCE" label="exchange" />
              <Radio value="FIXED_DESTINATION" label="receive" />
            </Group>
          </Radio.Group>
        </Section>

        <Section title="Credit controls">
          <section className="finapp-document" tabIndex={0} aria-label="Credit agreement">
            <pre>
              {[
                'PERSONAL LOAN AGREEMENT (demonstration text)',
                '1. Amount of credit: EUR 3,000.00',
                '2. Duration: 12 months',
                '3. Borrowing rate: 7.90% a year, fixed',
                '4. Total amount payable: EUR 3,130.04',
                ...Array.from({ length: 24 }, (_, i) => `${i + 5}. Demonstration clause ${i + 5}.`),
              ].join('\n')}
            </pre>
          </section>
          <Checkbox label="I have read the agreement and the figures above" />
          <Radio.Group label="What went wrong?">
            <Stack mt="xs" gap={4}>
              <Radio value="NOT_RECEIVED" label="I did not receive it" />
              <Radio value="OTHER" label="Something else" />
            </Stack>
          </Radio.Group>
          <Textarea label="Tell us what happened" maxLength={1000} autosize minRows={3} />
        </Section>

        <Section title="Core banking controls">
          <Group align="flex-end" wrap="wrap">
            <TextInput type="date" label="From" defaultValue="2026-11-01" />
            <TextInput type="date" label="To" defaultValue="2026-11-19" />
          </Group>
          <Tabs defaultValue="sent">
            <Tabs.List>
              <Tabs.Tab value="sent">Transfers sent</Tabs.Tab>
              <Tabs.Tab value="topups">Top-ups and purchases</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="sent" pt="md">
              <Text>
                <SignedMoney amount="20.00" currency="EUR" direction="out" />
              </Text>
            </Tabs.Panel>
            <Tabs.Panel value="topups" pt="md">
              <Text>
                <SignedMoney amount="100.00" currency="EUR" direction="in" />
              </Text>
            </Tabs.Panel>
          </Tabs>
        </Section>

        <Section title="Dialogs">
          <div>
            <Button onClick={() => setStepUpOpen(true)}>Open step-up dialog</Button>
          </div>
          <div>
            <Button color="red" variant="light" onClick={() => setDangerOpen(true)}>
              Open close-wallet confirmation
            </Button>
          </div>
          <StepUpDialog
            opened={stepUpOpen}
            onSubmit={async () => setStepUpOpen(false)}
            onCancel={() => setStepUpOpen(false)}
          />
          <ConfirmDangerous
            opened={dangerOpen}
            title="Close this wallet?"
            confirmLabel="Close wallet"
            onConfirm={() => setDangerOpen(false)}
            onCancel={() => setDangerOpen(false)}
          >
            <Text>The wallet must be empty. Closing it cannot be undone.</Text>
          </ConfirmDangerous>
        </Section>
      </Stack>
    </CustomerShell>
  );
}
