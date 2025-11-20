import {
  Box,
  Button,
  FormLabel,
  IconButton,
  Link,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  StyleProps,
  chakra,
  forwardRef as chakraForwardRef,
  useClipboard,
  useDisclosure,
} from '@chakra-ui/react';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { ReactElement, forwardRef, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Icons } from '../../Icons';

dayjs.extend(localizedFormat);

type AttributeBaseProps = {
  label: string;
  isCopyable?: boolean;
  isMasked?: boolean;
} & StyleProps;

export enum DateFormat {
  Short = 0,
  Long = 1,
  Full = 2,
}

const dateFormatStrings: Record<number, string | undefined> = {
  0: 'l',
  1: 'MMM D, YYYY h:mm A',
  2: 'MMM D, YYYY h:mm:ss A',
  3: undefined,
};

export const AttributeContainer = chakraForwardRef<{ label: string } & StyleProps, 'div'>(
  (props, ref): ReactElement => {
    const { label, children, ...styles } = props;
    return (
      <Box p="var(--chakra-space-3)" ref={ref} {...styles}>
        <FormLabel variant="view" w="fit-content" as="p">
          {label}
        </FormLabel>
        {children}
      </Box>
    );
  }
);

function _Attribute(
  props: AttributeBaseProps & {
    isUrl: true;
    isUrlExternal?: boolean;
    value: string | undefined;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: any
): JSX.Element;

function _Attribute(
  props: AttributeBaseProps & {
    isDate: true;
    defaultDateFmt?: DateFormat;
    value: Date | undefined | null;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: any
): JSX.Element;

function _Attribute(
  props: AttributeBaseProps & {
    value: string | undefined | null | boolean | number;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: any
): JSX.Element;

function _Attribute(
  props: AttributeBaseProps & {
    isUrl?: boolean | undefined;
    isUrlExternal?: boolean | undefined;
    isDate?: boolean | undefined;
    defaultDateFmt?: DateFormat;
    value: string | Date | undefined | null | boolean | number;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: any
) {
  const {
    isUrl,
    isUrlExternal,
    isDate,
    defaultDateFmt,
    value,
    label,
    isCopyable,
    isMasked,
    ...styles
  } = props;

  const resultValue =
    value === '' || value === undefined || value === null
      ? undefined
      : typeof value === 'object'
      ? value
      : String(value);
  const clipValue =
    resultValue === undefined
      ? ''
      : typeof resultValue === 'string'
      ? resultValue
      : resultValue.toISOString();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const clip = useClipboard(clipValue);
  const showSecret = useDisclosure({ defaultIsOpen: !isMasked });
  const maskedValue = showSecret.isOpen ? clipValue : '\u2022'.repeat(clipValue.length);

  useEffect(() => {
    function handleWindowBlur() {
      showSecret.onClose();
    }
    if (isMasked) {
      window.addEventListener('blur', handleWindowBlur);
      return () => window.removeEventListener('blur', handleWindowBlur);
    }
  }, []);

  return (
    <AttributeContainer ref={ref} {...styles} label={label}>
      <chakra.div display="inline-block" lineHeight={1} maxWidth="100%">
        {isCopyable && resultValue !== undefined ? (
          <CopyButton isMasked={isMasked} value={clipValue} />
        ) : null}
        {resultValue === undefined ? (
          <span>&nbsp;-&nbsp;</span>
        ) : isDate && showSecret.isOpen ? (
          <DateValue value={value as Date} defaultDateFmt={defaultDateFmt} />
        ) : isUrl && showSecret.isOpen ? (
          <Link
            color="blue.500"
            {...(isUrlExternal
              ? { href: value as string, target: '_blank', rel: 'noopener noreferrer' }
              : { as: RouterLink, to: value as string })}
          >
            {maskedValue}
          </Link>
        ) : (
          <chakra.span letterSpacing={showSecret.isOpen ? undefined : '2.7px'}>
            {maskedValue}
          </chakra.span>
        )}
        {isMasked && resultValue !== undefined ? (
          <Button
            fontWeight="medium"
            onClick={showSecret.onToggle}
            height="auto"
            variant="link"
            colorScheme="blue"
            size="md"
            ml={4}
          >
            {showSecret.isOpen ? 'Hide' : 'Show'}
          </Button>
        ) : null}
      </chakra.div>
    </AttributeContainer>
  );
}

export function CopyButton(
  props: {
    value: string;
    isMasked?: boolean;
  } & StyleProps
) {
  const { value, ...styles } = props;

  const clip = useClipboard(value);

  return (
    <Popover placement="top" {...styles}>
      <PopoverTrigger>
        <IconButton
          title="Copy"
          color="gray.500"
          _hover={{
            color: 'unset',
          }}
          h="auto"
          minW="auto"
          pr={2}
          pl="0.1em"
          fontSize="md"
          variant="unstyled"
          aria-label="copy"
          icon={<Icons.Copy />}
          onClick={clip.onCopy}
        />
      </PopoverTrigger>
      <PopoverContent boxShadow="lg" w="auto">
        <PopoverArrow />
        <PopoverBody
          lineHeight={0.9}
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          overflow="hidden"
          maxW="30em"
          p={3}
        >
          <Icons.CheckCircle color="green.500" display="inline" />
          &nbsp;&nbsp;Copied{props.isMasked ? null : <>&nbsp;&nbsp;{value}</>}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
export const Attribute = forwardRef(_Attribute) as typeof _Attribute;

export const DateValue = (props: { value: Date; defaultDateFmt?: DateFormat }) => {
  const [fmt, setFmt] = useState(props.defaultDateFmt ?? 0);
  const onClick = () => setFmt((old) => (fmt === 3 ? 0 : old + 1));
  return (
    <Link as="button" onClick={onClick}>
      {dayjs(props.value).format(dateFormatStrings[fmt])}
    </Link>
  );
};
