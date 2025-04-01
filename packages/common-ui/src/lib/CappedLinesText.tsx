import { TextProps, Text, ChakraComponent } from '@chakra-ui/react';

export const CappedLinesText = (({ maxLines, ...props }: TextProps & { maxLines?: number }) => (
  <Text
    as="span"
    css={[
      {
        display: '-webkit-box',
        WebkitLineClamp: maxLines ?? 1,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        wordBreak: 'break-all',
      },
      props.css,
    ]}
    {...props}
  />
)) as ChakraComponent<'span', { maxLines?: number }>;
