import {
  As,
  Box,
  Button,
  Collapse,
  HStack,
  Icon,
  IconButton,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { AnyRoute, Link as RouterLink } from '@tanstack/router';
import { useEffect } from 'react';
import { BsCaretRightFill } from 'react-icons/bs';
export interface INavButtonProps {
  route: AnyRoute;
  params?: object;
  onClick?: () => void;
  icon?: As;
  activeIcon?: As;
  text: string;
  childItems?: INavButtonProps[];
  depth?: number;
  isActive?: boolean;
}

// TODO: The "resource explorer"-style tree component should probably be its own nice abstraction, with navigation links merely implementing the required interface. With the expectation of that eventually happening, not much effort has been put into making the existing setup very elegant.

/**
 * Component which renders a navigation link, possibly with an
 * expandable nested list of indented sub-items.
 */
export const NavButton = (props: INavButtonProps) => {
  const { isOpen: isExpandedState, onToggle: toggleIsExpanded } =
    useDisclosure();
  const hasChildren = props?.childItems?.length;
  const checkIsExpandedNecessarily = (items: INavButtonProps[]): boolean =>
    items.some(
      (item) =>
        item.isActive || checkIsExpandedNecessarily(item.childItems || [])
    );
  const isExpandedNecessarily = checkIsExpandedNecessarily(
    props.childItems || []
  );
  const isExpanded = isExpandedNecessarily || isExpandedState;

  const depthOffset = `${props.depth || 0}em`;
  const button = (
    <Button
      aria-current={props.isActive ? 'page' : 'false'}
      fontWeight="normal"
      _activeLink={{
        fontWeight: 'bold',
      }}
      as={RouterLink}
      onClick={() => {
        if (!isExpanded) {
          // expand sub-tree if it's not already open
          toggleIsExpanded();
        } else if (props.isActive) {
          // close sub-tree only on redundant re-selection (not if navigating from a different item)
          toggleIsExpanded();
        }
        props.onClick && props.onClick();
      }}
      to={props.route.fullPath}
      params={(props.params as any) || {}}
      search={{}}
      w="100%"
      borderRadius="0px"
      px={`calc(0.25em + ${depthOffset})`}
      pl={`calc(0.25em + ${depthOffset} + 20px)`}
      h={8}
      fontSize="1em"
      variant="ghost"
      justifyContent="space-between"
      gap={1}
      title={props.text}
    >
      <Icon
        as={props.isActive && props.activeIcon ? props.activeIcon : props.icon}
      />
      <Text
        flexGrow={1}
        textAlign="left"
        as="span"
        flexShrink={1}
        textOverflow="ellipsis"
        overflow="hidden"
        lineHeight="normal"
      >
        {props.text}
      </Text>
    </Button>
  );

  if (hasChildren) {
    return (
      <>
        <HStack spacing={0}>
          {hasChildren ? (
            <Box pos="relative" h="20px" zIndex={2}>
              <IconButton
                isDisabled={isExpandedNecessarily}
                onClick={() => {
                  if (!isExpandedNecessarily) {
                    toggleIsExpanded();
                  }
                }}
                ml={`calc(0.25em + ${depthOffset})`}
                pos="absolute"
                aria-label="open or close"
                title="open or close"
                variant="unstyled"
                w="20px"
                h="20px"
                minH="20px"
                minW="20px"
                size="xs"
                className={isExpanded ? 'opened' : undefined}
                css={{
                  '&.opened': {
                    transition: '0.5s',
                    transform: 'rotate(90deg)',
                  },
                  svg: {
                    margin: 'auto',
                  },
                }}
                icon={<BsCaretRightFill />}
              />
            </Box>
          ) : undefined}
          {button}
        </HStack>
        <Collapse in={isExpanded} animateOpacity>
          <Box fontSize="1em">
            {props.childItems?.map((child) => (
              <NavButton
                key={child.text + child.route.fullPath}
                {...child}
                depth={(props.depth || 0) + 1}
              />
            ))}
          </Box>
        </Collapse>
      </>
    );
  } else {
    return button;
  }
};
