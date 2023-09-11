import { ChevronDownIcon } from '@chakra-ui/icons';
import { Button, Menu, MenuButton, MenuList, Portal } from '@chakra-ui/react';
import { ActionsType } from './ActionsType';
import { ActionBarButton, ActionMenuButton } from './getStandardActions';

export const PageActions = (props: { actions: ActionsType; show?: number | undefined | true }) => {
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
      {visible.map(([key, actionProps]) => (
        <ActionBarButton key={key} {...actionProps} />
      ))}
      {hidden.length > 0 && (
        <Menu>
          <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
            More
          </MenuButton>
          <Portal>
            <MenuList>
              {hidden.map(([key, actionProps]) => (
                <ActionMenuButton key={key} {...actionProps} />
              ))}
            </MenuList>
          </Portal>
        </Menu>
      )}
    </>
  );
};
