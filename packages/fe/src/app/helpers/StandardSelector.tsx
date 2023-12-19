import {
  Box,
  FormControl,
  HStack,
  Icon,
  IconButton,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverCloseButton,
  PopoverContent,
  PopoverHeader,
  PopoverTrigger,
} from '@chakra-ui/react';
import { VirtualizedSelect } from '@edanalytics/common-ui';
import { Select } from 'chakra-react-select';
import sortBy from 'lodash/sortBy';
import { ReactNode, forwardRef, useEffect, useMemo, useState } from 'react';
import {
  Control,
  Controller,
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from 'react-hook-form';
import { BsFunnel, BsFunnelFill } from 'react-icons/bs';
import once from 'lodash/once';
import { flushSync } from 'react-dom';
import { wait } from '@edanalytics/utils';

type BaseSelectProps = Partial<Omit<Parameters<typeof Select>[0], 'options' | 'name' | 'onBlur'>>;
type PassthroughSelectProps = Partial<
  Omit<Parameters<typeof Select>[0], 'options' | 'name' | 'onBlur' | 'onChange' | 'value'>
> & { isLoading?: boolean; autoSelectOnly?: boolean };

// TODO add deselect capability
function _InnerSelect(
  props: BaseSelectProps & {
    options: Record<string, { value: number | string; label: string; subLabel?: string }>;
    autoSelectOnly?: boolean;
    isLoading?: boolean;
  } & Omit<ControllerRenderProps<any, any>, 'ref' | 'name'>,
  ref?: any
): JSX.Element;
function _InnerSelect(
  props: BaseSelectProps & {
    options: Record<string, { value: number | string; label: string; subLabel?: string }>;
    autoSelectOnly?: boolean;
    isLoading?: boolean;
  } & Omit<ControllerRenderProps<any, any>, 'ref'>,
  ref?: any
): JSX.Element;
function _InnerSelect(
  props: BaseSelectProps & {
    options: Record<string, { value: number | string; label: string; subLabel?: string }>;
    autoSelectOnly?: boolean;
    isLoading?: boolean;
  } & Omit<ControllerRenderProps<any, any>, 'ref' | 'name'> &
    Partial<Pick<ControllerRenderProps<any, any>, 'name'>>,
  ref?: any
) {
  const {
    options,
    autoSelectOnly,
    isLoading,
    value: rawValue,
    onChange,
    name,
    onBlur,
    ...others
  } = props;
  const value = rawValue === undefined ? null : rawValue;
  const optionsArray = useMemo(
    () => sortBy(Object.values(props.options), 'label'),
    [props.options]
  );
  const [hasAutoSelected, setHasAutoSelected] = useState(false);

  useEffect(() => {
    const shouldAutoClear = isLoading === false && value !== null && !(String(value) in options);
    const shouldAutoSelectOnly =
      !hasAutoSelected &&
      isLoading === false &&
      autoSelectOnly &&
      optionsArray.length === 1 &&
      value === null;

    if (shouldAutoClear) {
      onChange(null);
    } else if (shouldAutoSelectOnly) {
      setHasAutoSelected(true);
      /* react-hook-form appears to not register the change if we don't wait a tick. This
      issue is only encountered when the selector's options are already loaded for some
      reason when the initial render happens. For example a role selector after roles have
      already been fetched by react-query for some other component. So the auto-select
      capability is flaky unless we wait a moment to run it. */
      wait(100).then(() => onChange(optionsArray[0].value));
    }
  }, [
    options,
    value,
    onChange,
    isLoading,
    autoSelectOnly,
    optionsArray,
    hasAutoSelected,
    setHasAutoSelected,
  ]);

  const isClearable = props.isClearable && value !== null;

  return (
    <VirtualizedSelect
      {...others}
      ref={ref}
      isClearable={isClearable}
      options={optionsArray as any}
      name={name}
      onBlur={onBlur}
      selectedOptionStyle="check"
      value={
        value === null
          ? { label: 'Select an option', value: '' as any }
          : {
              label: isLoading ? '...loading' : options?.[value as any]?.label ?? '',
              subLabel: isLoading ? undefined : options?.[value as any]?.subLabel,
              value: value,
            }
      }
      onChange={(value: any) => onChange(value?.value ?? null)}
    />
  );
}

const InnerSelect = forwardRef(_InnerSelect);

export function SelectWrapper<Dto extends Record<Name, number>, Name extends keyof Dto>(
  props: PassthroughSelectProps & {
    name?: Name;
    options: Record<string, { value: number | string; label: string; subLabel?: string }>;
    filterApplied?: boolean;
    filterPane?: ReactNode;
    onFilterDoubleClick?: () => void;
  } & (
      | {
          control: Control<Dto>;
        }
      | {
          onChange: (...event: any[]) => void;
          onBlur: () => void;
          value: any;
        }
    ) &
    BaseSelectProps
) {
  return (
    <HStack>
      <Box flexGrow={1}>
        {'control' in props ? (
          <Controller
            control={props.control}
            name={props.name as any}
            render={(args) => {
              const { ref, ...others } = props;
              return <InnerSelect {...args.field} {...others} />;
            }}
          />
        ) : (
          <InnerSelect {...(props as any)} />
        )}
      </Box>
      {props.filterPane === undefined || props.filterPane === null ? null : (
        <Popover>
          <PopoverTrigger>
            <IconButton
              isDisabled={!!props.isDisabled}
              variant="ghost"
              aria-label="edit filters"
              icon={<Icon as={props.filterApplied ? BsFunnelFill : BsFunnel} />}
              onDoubleClick={props.onFilterDoubleClick}
            />
          </PopoverTrigger>
          <PopoverContent w="xs">
            <PopoverArrow />

            <PopoverHeader justifyContent="space-between" display="flex" fontWeight="bold">
              Filters <PopoverCloseButton position="unset" />
            </PopoverHeader>
            <PopoverBody>
              <FormControl display="flex" py="1em" gap="0.35em" flexDir="column">
                {props.filterPane}
              </FormControl>
            </PopoverBody>
          </PopoverContent>
        </Popover>
      )}
    </HStack>
  );
}
export type StandardSelector<ExtraProps extends object = object> = {
  <
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
  >(
    props: {
      control: Control<TFieldValues>;
      name: TName;
    } & ExtraProps &
      PassthroughSelectProps
  ): JSX.Element;
  <
    // these are unused; they're still here only bc of a strange TS quirk. https://www.typescriptlang.org/play?#code/C4TwDgpgBAYgrgOwMYBVzQLxQN4CgoFQA8A4hAhAE4CWq6UEAHsOQCYDOUA9gEYBWEJMAB8ACgBuAQwA2cCOwBcUMhRp1IAbQC6ASiUqqtNJADc+QuYIB6K1ADKAd2rAkACyjBX0HhGlcHUNLUFJzBUJIIrNxwwB5cUOwQ0J7QAI5w1JQA1gB0llD5NsQGasbQTCyRnLwCQmJSshBKCHAAtj6UegnANAgA5iZQRX3khkge9BQQrNNQAGZclAlcrdCUEJLsXAj5EjJyzW0dXew9wQO4AL64uEjbp1CtIPDISi-qmFCikpR9OhjCPCEKDrYBwSgIKCIGZzYKzTbhBAgK5AA
    TFieldValues extends FieldValues = FieldValues,
    TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
  >(
    props: {
      onChange: (value: number | string | undefined) => void;
      value: number | string | undefined;
    } & Omit<ControllerRenderProps<any, any>, 'ref' | 'name' | 'value'> &
      ExtraProps &
      PassthroughSelectProps
  ): JSX.Element;
};
