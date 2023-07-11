import { Box, Checkbox, Tag } from '@chakra-ui/react';
import { GetPrivilegeDto, PrivilegeCode, privilegeCodes } from '@edanalytics/models';
import _ from 'lodash';

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
                <SinglePrivilege
                  key={p}
                  code={p}
                  set={(val: boolean) => set([p], val)}
                  value={value.has(p)}
                />
              );
            } else {
              throw new Error('somethin wrong');
            }
          } else {
            if (childs === undefined) {
              throw new Error('something else wrong');
            } else {
              return (
                <PrivilegeGroup children={childs} header={str} set={set} value={value} key={str} />
              );
            }
          }
        })}
      </Box>
    </>
  );
};
const SinglePrivilege = (props: {
  code: PrivilegeCode;
  value: boolean;
  set: (v: boolean) => void;
}) => {
  return (
    <Checkbox
      display="flex"
      my={1}
      isChecked={props.value}
      onChange={(e) => props.set(e.target.checked)}
    >
      <Tag key={props.code} colorScheme="orange" display="flex" w="max-content">
        {props.code}
      </Tag>
    </Checkbox>
  );
};
export const PrivilegesInput = (props: {
  value: PrivilegeCode[];
  onChange: (newValue: PrivilegeCode[]) => void;
  privileges: GetPrivilegeDto[];
}) => {
  const valueSet = new Set(props.value);
  const privileges = props.privileges;
  const nested = privileges.reduce<PrivilegeNest>((acc, { code }) => {
    const [path, action] = code.split(':');
    const pathArr = path.split('.');
    _.set(acc, [...pathArr, code], {});
    return acc;
  }, {});

  const set = (privileges: PrivilegeCode[], val: boolean) => {
    const newValue = new Set(props.value);
    if (val) {
      privileges.forEach((p) => newValue.add(p));
    } else {
      privileges.forEach((p) => newValue.delete(p));
    }
    props.onChange([...newValue.values()]);
  };
  return <PrivilegeGroup header="All" children={nested} set={set} value={valueSet} />;
};
