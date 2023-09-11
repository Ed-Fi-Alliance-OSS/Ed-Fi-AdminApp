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
import { useEffect } from 'react';
import { BsCaretRightFill } from 'react-icons/bs';
import { Link as RouterLink } from 'react-router-dom';
export interface INavButtonProps {
  route: string;
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
  const isActive = props.isActive && !props.childItems?.some((child) => child.isActive);
  const { isOpen: isExpandedState, onToggle: toggleIsExpanded, onOpen: expand } = useDisclosure();
  const hasChildren = props?.childItems?.length;
  const checkisChildExpanded = (items: INavButtonProps[]): boolean =>
    items.some((item) => item.isActive || checkisChildExpanded(item.childItems || []));
  const isChildExpanded = checkisChildExpanded(props.childItems || []);

  useEffect(() => {
    isChildExpanded && expand();
  }, [isChildExpanded, expand]);

  const depthOffset = `${props.depth || 0}em`;
  const button = (
    <Button
      color={isActive ? 'teal.800' : undefined}
      borderLeft="2px solid"
      borderRight="2px solid"
      borderColor={isActive ? 'teal.500' : 'transparent'}
      bg={isActive ? 'gray.100' : undefined}
      aria-current={isActive ? 'page' : 'false'}
      _hover={{
        bg: isActive ? 'gray.200' : 'gray.100',
      }}
      fontWeight="normal"
      _activeLink={{
        fontWeight: '700',
      }}
      as={RouterLink}
      onClick={() => {
        if (!isExpandedState) {
          // expand sub-tree if it's not already open
          toggleIsExpanded();
        } else if (isActive) {
          // close sub-tree only on redundant re-selection (not if navigating from a different item)
          toggleIsExpanded();
        }
      }}
      to={props.route}
      w="100%"
      borderRadius="0px"
      px={`calc(0.25em + ${depthOffset})`}
      pl={`calc(0.25em + ${depthOffset} + 23px)`}
      h={9}
      fontSize="1em"
      variant="ghost"
      justifyContent="space-between"
      gap={3}
      title={props.text}
    >
      <Icon fontSize="xl" as={isActive && props.activeIcon ? props.activeIcon : props.icon} />
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
                onClick={toggleIsExpanded}
                ml={`calc(0.6em + ${depthOffset})`}
                pos="absolute"
                aria-label="open or close"
                title="open or close"
                variant="unstyled"
                w="20px"
                h="20px"
                minH="20px"
                minW="20px"
                size="xs"
                className={isExpandedState ? 'opened' : undefined}
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
        <Collapse in={isExpandedState} animateOpacity>
          <Box fontSize="1em">
            {props.childItems?.map((child) => (
              <NavButton key={child.text + child.route} {...child} depth={(props.depth || 0) + 1} />
            ))}
          </Box>
        </Collapse>
      </>
    );
  } else {
    return button;
  }
};
