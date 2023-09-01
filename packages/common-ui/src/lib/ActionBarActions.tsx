import { Button, Menu, MenuButton, MenuList, Portal } from '@chakra-ui/react';
import { ActionBarButton, ActionMenuButton } from './getStandardActions';
import { ChevronDownIcon } from '@chakra-ui/icons';
import { ActionsType } from './ActionsType';
import * as React from 'react';

export const ActionBarActions = (props: {
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
      : // show 4 by default, including "more" menu
      show === undefined
      ? hidden.length === 4
        ? 4
        : 3
      : // show defined number
        show
  );
  return (
    <>
      {visible.map(([key, Action]) => (
        <Action key={key}>{ActionBarButton}</Action>
      ))}
      {hidden.length > 0 && (
        <Menu>
          <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
            More
          </MenuButton>
          <Portal>
            <MenuList>
              {hidden.map(([key, Action]) => (
                <Action key={key}>{ActionMenuButton}</Action>
              ))}
            </MenuList>
          </Portal>
        </Menu>
      )}
    </>
  );
};
