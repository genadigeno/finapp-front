// How a module declares its pages (blueprint §9). The router (src/app) builds the route tree from these;
// a module never imports another module or the router. Pages load on first visit (route-level code
// splitting, blueprint §16).
import type { Icon } from '@tabler/icons-react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { MessageDescriptor } from 'react-intl';

export type RouteAccess =
  /** Anyone. */
  | 'public'
  /** Only with a session; a signed-out visitor goes to the start page with this path as `returnTo`. */
  | 'signed-in'
  /** Only without a session (sign-in, registration); a signed-in customer goes home. */
  | 'signed-out';

export interface AppRoute {
  /** A static path. Pages never carry a customer's identifier in a path in Stage 2. */
  path: string;
  access: RouteAccess;
  component: LazyExoticComponent<ComponentType> | ComponentType;
  /** Shown in the shell's main navigation, in this order, when the customer may open the page. */
  nav?: { label: MessageDescriptor; icon: Icon; order: number };
  /** May be a post-sign-in `returnTo` target (ADR-F07 decision 7). Only static, identifier-free paths. */
  returnable?: boolean;
}
