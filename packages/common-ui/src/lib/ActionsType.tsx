import { IconType } from './Icons/types';

export type ActionsType = Record<string, ActionPropsConfirm | ActionProps | LinkActionProps>;

export type ActionProps = {
  onClick: () => void;
  icon: IconType;
  text: string;
  title: string;
  isDisabled?: boolean;
  isPending?: boolean;
  /** Flag that an action should be available but at the bottom of the list. For example connect SB meta when there's already a connection. */
  isIrrelevant?: boolean;
};
export type ActionPropsConfirm = ActionProps & {
  confirmBody: string;
  confirm: true;
};

export type LinkActionProps = ActionProps & {
  to: string;
};
