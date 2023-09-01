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
  chakra,
  useClipboard,
  useDisclosure,
} from '@chakra-ui/react';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { ReactNode, useState } from 'react';
import { BiCopy } from 'react-icons/bi';
import { BsCheckCircle } from 'react-icons/bs';
import { Link as RouterLink } from 'react-router-dom';

dayjs.extend(localizedFormat);

interface AttributeBaseProps {
  label: string;
  isCopyable?: boolean;
  isMasked?: boolean;
}
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

export const AttributeContainer = (props: { label: string; children: ReactNode }) => (
  <Box p="var(--chakra-space-3)">
    <FormLabel variant="view" as="p">
      {props.label}
    </FormLabel>
    {props.children}
  </Box>
);

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
  const value =
    props.value === '' || props.value === undefined || props.value === null
      ? undefined
      : typeof props.value === 'object'
      ? props.value
      : String(props.value);
  const clipValue =
    value === undefined ? '' : typeof value === 'string' ? value : value.toISOString();

  const clip = useClipboard(clipValue);
  const showSecret = useDisclosure({ defaultIsOpen: !props.isMasked });
  const maskedValue = showSecret.isOpen ? clipValue : '\u2022'.repeat(clipValue.length);
  return (
    <AttributeContainer label={props.label}>
      <chakra.div display="inline-block" lineHeight={1}>
        {props.isCopyable && value !== undefined ? (
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
        {value === undefined ? (
          <span>&nbsp;-&nbsp;</span>
        ) : props.isDate && showSecret.isOpen ? (
          <DateValue value={props.value as Date} defaultDateFmt={props.defaultDateFmt} />
        ) : props.isUrl && showSecret.isOpen ? (
          <Link
            {...(props.isUrlExternal
              ? { href: props.value as string, target: '_blank', rel: 'noopener noreferrer' }
              : { as: RouterLink, to: props.value as string })}
          >
            {maskedValue}
          </Link>
        ) : (
          <chakra.span letterSpacing={showSecret.isOpen ? undefined : '2.7px'}>
            {maskedValue}
          </chakra.span>
        )}
        {props.isMasked && value !== undefined ? (
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
