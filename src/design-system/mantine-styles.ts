// Mantine's styles for the components this application uses - not the whole 300 KB library sheet (D-R WP-9, the
// first-load lever named by Stage 7). Order follows Mantine's per-component guide: the base, then the building blocks
// other components are made of, then the components.
//
// RULE: a component newly imported from '@mantine/core' needs its sheet here (and those of the parts it is made of),
// or it renders unstyled. The screenshot run (e2e/catalogue/screenshots.spec.ts) shows it at once.
import '@mantine/core/styles/baseline.css';
import '@mantine/core/styles/default-css-variables.css';
import '@mantine/core/styles/global.css';
// Building blocks.
import '@mantine/core/styles/UnstyledButton.css';
import '@mantine/core/styles/VisuallyHidden.css';
import '@mantine/core/styles/Paper.css';
import '@mantine/core/styles/Popover.css';
import '@mantine/core/styles/CloseButton.css';
import '@mantine/core/styles/Group.css';
import '@mantine/core/styles/Loader.css';
import '@mantine/core/styles/Overlay.css';
import '@mantine/core/styles/ModalBase.css';
import '@mantine/core/styles/Input.css';
import '@mantine/core/styles/InlineInput.css';
import '@mantine/core/styles/ScrollArea.css';
import '@mantine/core/styles/Combobox.css';
// Components imported by the application.
import '@mantine/core/styles/ActionIcon.css';
import '@mantine/core/styles/Alert.css';
import '@mantine/core/styles/Anchor.css';
import '@mantine/core/styles/Badge.css';
import '@mantine/core/styles/Button.css';
import '@mantine/core/styles/Card.css';
import '@mantine/core/styles/Checkbox.css';
import '@mantine/core/styles/Divider.css';
import '@mantine/core/styles/List.css';
import '@mantine/core/styles/Modal.css';
import '@mantine/core/styles/PasswordInput.css';
import '@mantine/core/styles/Radio.css';
import '@mantine/core/styles/Skeleton.css';
import '@mantine/core/styles/Stack.css';
import '@mantine/core/styles/Table.css';
import '@mantine/core/styles/Tabs.css';
import '@mantine/core/styles/Text.css';
import '@mantine/core/styles/ThemeIcon.css';
import '@mantine/core/styles/Title.css';
