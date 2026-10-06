import { IconType } from './Icons/types';

export type ActionsType = Record<string, ActionPropsConfirm | ActionProps | LinkActionProps>;

export type ActionProps = {
  onClick: () => void;
  icon: IconType;
  text: string;
  title: string;
  /** Overrides the accessible name. `title` alone is not enough: the icon-button
   * variant sets `aria-label` from `text`, and `aria-label` outranks `title` in
   * accessible-name computation, so a reason carried only in `title` is
   * announced to nobody. Set this when the button's state has an explanation
   * that assistive-technology users need. */
  ariaLabel?: string;
  isDisabled?: boolean;
  /** While true, the action is shown inline (appended after the inline buttons, never displacing them) so its progress is visible. Takes precedence over `overflowOnly`. */
  isPending?: boolean;
  /** Flag that an action should be available but at the bottom of the list. For example connect SB meta when there's already a connection. */
  isIrrelevant?: boolean;
  /** Always place the action in the overflow menu, without counting it toward the inline target. Adding one never pushes an existing action out of the inline buttons. While `isPending`, it's shown inline instead. */
  overflowOnly?: boolean;
};
export type ActionPropsConfirm = ActionProps & {
  confirmBody: string;
  confirm: true;
};

export type LinkActionProps = ActionProps & {
  to: string;
};
