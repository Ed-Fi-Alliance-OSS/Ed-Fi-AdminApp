import { ButtonGroup, Icon, IconButton, Menu, MenuButton, MenuList } from '@chakra-ui/react';
import { ActionMenuButton, TdIconButton } from './getStandardActions';
import { BiDotsVerticalRounded } from 'react-icons/bi';
import { ActionsType } from './ActionsType';

export const TableRowActions = (props: {
  actions: ActionsType;
  show?: number | undefined | true;
}) => {
  const { show, actions } = props;
  const hidden = Object.entries(actions);
  const visible = hidden.splice(
    0,
    // show all
    show === true
      ? hidden.length
      : // show default, which is 4 buttons
      show === undefined
      ? hidden.length === 4
        ? // ...all of them being actions if no overflow necessary
          4
        : // or only 3 actions if 1 button is overflow
          3
      : // show custom number
        show
  );
  return (
    <ButtonGroup
      className="row-hover"
      size="table-row"
      m="-0.5rem 0 -0.5rem 0"
      variant="ghost-dark"
      spacing={0}
      colorScheme="gray"
    >
      {visible.map(([key, Action]) => (
        <Action key={key}>{TdIconButton}</Action>
      ))}
      {hidden.length > 0 && (
        <Menu>
          <MenuButton
            as={IconButton}
            aria-label="more"
            px="0.3rem"
            icon={<Icon as={BiDotsVerticalRounded} />}
          />
          <MenuList>
            {hidden.map(([key, Action]) => (
              <Action key={key}>{ActionMenuButton}</Action>
            ))}
          </MenuList>
        </Menu>
      )}
    </ButtonGroup>
  );
};
