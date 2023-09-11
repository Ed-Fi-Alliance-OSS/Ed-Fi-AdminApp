import { IconType } from 'react-icons/lib';

export type ActionsType = Record<string, ActionPropsConfirm | ActionProps | LinkActionProps>;

export type ActionProps = {
  onClick: () => void;
  icon: IconType;
  text: string;
  title: string;
  isDisabled?: boolean;
  isLoading?: boolean;
};
export type ActionPropsConfirm = ActionProps & {
  confirmBody: string;
  confirm: true;
};

export type LinkActionProps = ActionProps & {
  to: string;
};
