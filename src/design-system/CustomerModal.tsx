// The application's only modal. Adapted from finapp-admin-panel/src/design-system/ConsoleModal.tsx (ADR-F08).
//
// Mantine's Modal locks page scroll through react-remove-scroll-bar, which injects an inline <style>
// element - refused by the CSP (ADR-F07). This wrapper turns that lock off and locks scroll with a static
// CSS rule keyed on a body attribute instead, and gives the close button an accessible name.
// eslint-disable-next-line no-restricted-imports -- the one sanctioned use of Mantine's Modal.
import { Modal, type ModalProps } from '@mantine/core';
import { useEffect } from 'react';
import { useIntl } from 'react-intl';

const LOCK_ATTRIBUTE = 'data-finapp-scroll-locked';
let openModals = 0;

export type CustomerModalProps = Omit<ModalProps, 'lockScroll' | 'closeButtonProps'>;

export function CustomerModal(props: CustomerModalProps) {
  const intl = useIntl();
  const { opened } = props;
  useEffect(() => {
    if (!opened) return undefined;
    openModals += 1;
    document.body.setAttribute(LOCK_ATTRIBUTE, '');
    return () => {
      openModals -= 1;
      if (openModals === 0) document.body.removeAttribute(LOCK_ATTRIBUTE);
    };
  }, [opened]);
  return (
    <Modal
      {...props}
      lockScroll={false}
      closeButtonProps={{ 'aria-label': intl.formatMessage({ id: 'modal.close', defaultMessage: 'Close' }) }}
    />
  );
}
