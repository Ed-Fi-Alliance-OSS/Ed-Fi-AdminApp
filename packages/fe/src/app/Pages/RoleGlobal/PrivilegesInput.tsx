import {
  Box,
  Checkbox,
  FormControl,
  FormErrorMessage,
  HStack,
  Icon,
  Tag,
  Text,
} from '@chakra-ui/react';
import {
  DependencyErrors,
  GetPrivilegeDto,
  PrivilegeCode,
  privilegeCodes,
  privilegeDependencies,
} from '@edanalytics/models';
import set from 'lodash/set';
import { BsCheckAll, BsXLg } from 'react-icons/bs';

type PrivilegeNest = Partial<{ [code: string]: PrivilegeNest }>;
const privilegeCodesSet = new Set(privilegeCodes);
const isDeepTrue = (children: PrivilegeNest, value: Set<PrivilegeCode>) => {
  let accumulator: boolean | null | undefined = undefined;
  (Object.keys(children) as PrivilegeCode[]).forEach((k) => {
    accumulator = _isDeepTrue(k, children[k] ?? {}, value, accumulator);
  });
  return accumulator === undefined ? true : accumulator;
};
const _isDeepTrue = (
  p: string,
  children: PrivilegeNest,
  value: Set<PrivilegeCode>,
  acc: boolean | null | undefined
) => {
  if (privilegeCodesSet.has(p)) {
    const thisPrivilege = value.has(p as any);
    if (acc === undefined) {
      acc = thisPrivilege;
    }
    if ((thisPrivilege && acc) || (!thisPrivilege && !acc)) {
      // do nothing it's already correct
    } else {
      // it's mixed
      acc = null;
    }
    if (acc === null) {
      return acc;
    }
  } else {
    (Object.keys(children) as PrivilegeCode[]).forEach((k) => {
      acc = _isDeepTrue(k, children[k] ?? {}, value, acc);
    });
  }
  return acc;
};
const getPrivileges = (value: PrivilegeNest): PrivilegeCode[] => {
  return Object.entries(value)
    .map(([k, children]) => {
      if (Object.entries(children as object).length === 0) {
        return k;
      } else {
        return getPrivileges(children as object);
      }
    })
    .flat() as PrivilegeCode[];
};
const PrivilegeGroup = (props: {
  error: DependencyErrors | undefined;
  set: (p: PrivilegeCode[], v: boolean) => void;
  value: Set<PrivilegeCode>;
  header: string;
  children: PrivilegeNest;
}) => {
  const { set, value, header: privilege, children } = props;
  const allTrue = isDeepTrue(children, value);
  const allChildren = getPrivileges(children);
  return (
    <>
      <Box>
        <Checkbox
          isChecked={!!allTrue}
          isIndeterminate={allTrue === null}
          onChange={() => {
            const newValue = allTrue !== true;
            set(allChildren, newValue);
          }}
        >
          {privilege}
        </Checkbox>
      </Box>
      <Box ml="2em">
        {Object.entries(children).map(([str, childs]) => {
          if (Object.keys(childs || {}).length === 0) {
            if (privilegeCodesSet.has(str)) {
              const p = str as PrivilegeCode;
              return (
                <SinglePrivilege error={props.error} key={p} code={p} set={set} value={value} />
              );
            } else {
              throw new Error('somethin wrong');
            }
          } else {
            if (childs === undefined) {
              throw new Error('something else wrong');
            } else {
              return (
                <PrivilegeGroup
                  error={props.error}
                  children={childs}
                  header={str}
                  set={set}
                  value={value}
                  key={str}
                />
              );
            }
          }
        })}
      </Box>
    </>
  );
};
const SinglePrivilege = (props: {
  error: DependencyErrors | undefined;
  code: PrivilegeCode;
  value: Set<PrivilegeCode>;
  set: (p: PrivilegeCode[], v: boolean) => void;
}) => {
  const dependencies = privilegeDependencies[props.code]?.dependencies;
  let allDepsIncluded = true;
  const errMsg = props.error?.[props.code];
  const isChecked = props.value.has(props.code);
  return (
    <FormControl
      isDisabled={props.code === 'me:read' || props.code === 'privilege:read'}
      isInvalid={!!errMsg}
    >
      <Checkbox isChecked={isChecked} onChange={(e) => props.set([props.code], e.target.checked)}>
        <HStack my={1} alignContent="baseline" display="flex" flexDir="row" flexWrap="wrap">
          <Tag key={props.code} colorScheme="orange" display="flex" w="max-content">
            {props.code}
          </Tag>
          {dependencies?.length && isChecked ? (
            <>
              <Text lineHeight={1} opacity="0.7" fontSize="sm" fontWeight="medium" ml={8}>
                requires:
              </Text>
              {dependencies.map((p) => {
                const depIncluded = props.value.has(p);
                if (!depIncluded) allDepsIncluded = false;
                return (
                  <Tag
                    flexShrink={0}
                    opacity="0.7"
                    size="sm"
                    key={p}
                    display="flex"
                    w="max-content"
                    {...(depIncluded
                      ? { colorScheme: 'gray' }
                      : {
                          colorScheme: 'red',
                          as: 'button',
                          _hover: { opacity: '1' },
                          title: 'Add missing dependency',
                          onClick: (e) => {
                            e.preventDefault();
                            props.set([p], true);
                          },
                        })}
                  >
                    {p}
                  </Tag>
                );
              })}
              <Icon
                as={allDepsIncluded ? BsCheckAll : BsXLg}
                color={allDepsIncluded ? 'green' : 'red'}
              />
            </>
          ) : null}
        </HStack>
      </Checkbox>
      <FormErrorMessage mb={4}>{errMsg}</FormErrorMessage>
    </FormControl>
  );
};
export const PrivilegesInput = (props: {
  error: DependencyErrors | undefined;
  value: PrivilegeCode[];
  onChange: (newValue: PrivilegeCode[]) => void;
  privileges: GetPrivilegeDto[];
}) => {
  const valueSet = new Set(props.value);
  const privileges = props.privileges;
  const nested = privileges.reduce<PrivilegeNest>((acc, { code }) => {
    const [path, action] = code.split(':');
    const pathArr = path.split('.');
    set(acc, [...pathArr, code], {});
    return acc;
  }, {});

  const setPrivileges = (privileges: PrivilegeCode[], val: boolean) => {
    const newValue = new Set(props.value);
    if (val) {
      privileges.forEach((p) => newValue.add(p));
    } else {
      privileges.forEach((p) => newValue.delete(p));
    }
    newValue.add('me:read');
    newValue.add('privilege:read');
    props.onChange([...newValue.values()]);
  };
  return (
    <PrivilegeGroup
      error={props.error}
      header="All"
      children={nested}
      set={setPrivileges}
      value={valueSet}
    />
  );
};
