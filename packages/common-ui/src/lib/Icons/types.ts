import { type IconProps as OriginalProps } from '@chakra-ui/icon';

export interface IconProps extends OriginalProps {
  isFilled?: boolean;
}

export type IconType = (props: IconProps) => React.JSX.Element;
