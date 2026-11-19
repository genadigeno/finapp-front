// The application frame (blueprint §6): a header with the brand and, when signed in, the customer's goals
// as navigation - a top bar on wide screens, a bottom bar on phones - and the page in a readable column.
// Static CSS only: Mantine's AppShell writes its layout through an inline <style>, which the CSP refuses.
import { ActionIcon, Group, UnstyledButton } from '@mantine/core';
import { IconMoon, IconSun, type Icon } from '@tabler/icons-react';
import { useMantineColorScheme } from '@mantine/core';
import type { ReactNode } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';

const messages = defineMessages({
  skip: { id: 'shell.skip', defaultMessage: 'Skip to content' },
  primaryNav: { id: 'shell.nav', defaultMessage: 'Main' },
  toDark: { id: 'shell.toDark', defaultMessage: 'Switch to dark theme' },
  toLight: { id: 'shell.toLight', defaultMessage: 'Switch to light theme' },
});

export interface NavItem {
  label: string;
  href: string;
  icon: Icon;
  active?: boolean;
}

export interface CustomerShellProps {
  children: ReactNode;
  /** Empty while signed out. */
  navigation?: readonly NavItem[];
  /** The account area at the right of the header (the customer's name, sign out). */
  account?: ReactNode;
  /** Renders a navigation link; the router provides one, the catalogue a plain anchor. */
  renderLink?: (item: NavItem, children: ReactNode, className: string) => ReactNode;
  /** Shown above the page (the session-expiry warning, an offline banner). */
  banner?: ReactNode;
}

const defaultLink = (item: NavItem, children: ReactNode, className: string) => (
  <a href={item.href} className={className} aria-current={item.active ? 'page' : undefined}>
    {children}
  </a>
);

export function CustomerShell({
  children,
  navigation = [],
  account,
  renderLink = defaultLink,
  banner,
}: CustomerShellProps) {
  const intl = useIntl();
  const { colorScheme, setColorScheme } = useMantineColorScheme({ keepTransitions: true });
  const dark = colorScheme === 'dark';
  const themeLabel = intl.formatMessage(dark ? messages.toLight : messages.toDark);
  return (
    <div className="finapp-shell" data-has-nav={navigation.length > 0 || undefined}>
      <a className="finapp-skip-link" href="#main">
        <FormattedMessage {...messages.skip} />
      </a>
      <header className="finapp-shell__header">
        <span className="finapp-shell__brand">FinApp</span>
        {navigation.length === 0 ? null : (
          <nav className="finapp-shell__nav" aria-label={intl.formatMessage(messages.primaryNav)}>
            {navigation.map((item) => (
              <span key={item.href}>
                {renderLink(
                  item,
                  <>
                    <item.icon size={20} aria-hidden />
                    <span>{item.label}</span>
                  </>,
                  'finapp-shell__link',
                )}
              </span>
            ))}
          </nav>
        )}
        <Group gap="xs" wrap="nowrap" className="finapp-shell__account">
          {/* A native title, not Mantine's Tooltip: the Tooltip brings its positioning library into the
              first load of every page (Stage 3 budget), and the button already has its accessible name. */}
          <ActionIcon
            variant="subtle"
            size="xl"
            aria-label={themeLabel}
            title={themeLabel}
            onClick={() => setColorScheme(dark ? 'light' : 'dark')}
          >
            {dark ? <IconSun size={20} aria-hidden /> : <IconMoon size={20} aria-hidden />}
          </ActionIcon>
          {account}
        </Group>
      </header>
      {banner === undefined ? null : <div className="finapp-shell__banner">{banner}</div>}
      <main id="main" className="finapp-shell__main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

/** A plain-text button that looks like a link (sign out, "change"). */
export function TextButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <UnstyledButton className="finapp-text-button" onClick={onClick}>
      {children}
    </UnstyledButton>
  );
}
