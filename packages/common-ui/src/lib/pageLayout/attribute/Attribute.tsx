import {
  Box,
  Button,
  FormLabel,
  Icon,
  IconButton,
  Link,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  StyleProps,
  chakra,
  useClipboard,
  useDisclosure,
} from '@chakra-ui/react';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { ReactNode, useEffect, useState } from 'react';
import { BiCopy } from 'react-icons/bi';
import { BsCheckCircle } from 'react-icons/bs';
import { Link as RouterLink } from 'react-router-dom';

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

export const AttributeContainer = (props: { label: string; children: ReactNode } & StyleProps) => {
  const { label, children, ...styles } = props;
  return (
    <Box p="var(--chakra-space-3)" {...styles}>
      <FormLabel variant="view" as="p">
        {label}
      </FormLabel>
      {children}
    </Box>
  );
};

export function Attribute(
  props: AttributeBaseProps & {
    isUrl: true;
    isUrlExternal?: boolean;
    value: string | undefined;
  }
): JSX.Element;

export function Attribute(
  props: AttributeBaseProps & {
    isDate: true;
    defaultDateFmt?: DateFormat;
    value: Date | undefined | null;
  }
): JSX.Element;

export function Attribute(
  props: AttributeBaseProps & {
    value: string | undefined | null | boolean | number;
  }
): JSX.Element;

export function Attribute(
  props: AttributeBaseProps & {
    isUrl?: boolean | undefined;
    isUrlExternal?: boolean | undefined;
    isDate?: boolean | undefined;
    defaultDateFmt?: DateFormat;
    value: string | Date | undefined | null | boolean | number;
  }
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
    <AttributeContainer {...styles} label={label}>
      <chakra.div display="inline-block" lineHeight={1}>
        {isCopyable && resultValue !== undefined ? (
          <Popover placement="top">
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
                icon={<Icon as={BiCopy} />}
                onClick={clip.onCopy}
              />
            </PopoverTrigger>
            <PopoverContent boxShadow="lg" w="auto">
              <PopoverArrow />
              <PopoverBody display="flex" p={3}>
                <Icon as={BsCheckCircle} color="green.500" />
                &nbsp;&nbsp;Copied
              </PopoverBody>
            </PopoverContent>
          </Popover>
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
            onClick={() => {
              if (showSecret.isOpen) {
                showSecret.onToggle();
              } else {
                showSecret.onToggle();
              }
            }}
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

export const DateValue = (props: { value: Date; defaultDateFmt?: DateFormat }) => {
  const [fmt, setFmt] = useState(props.defaultDateFmt ?? 0);
  const onClick = () => setFmt((old) => (fmt === 3 ? 0 : old + 1));
  return (
    <Link as="button" onClick={onClick}>
      {dayjs(props.value).format(dateFormatStrings[fmt])}
    </Link>
  );
};
