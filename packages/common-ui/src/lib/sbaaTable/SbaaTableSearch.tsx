import {
  Button,
  ChakraComponent,
  HStack,
  Icon,
  IconButton,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from '@chakra-ui/react';
import { BiSearch } from 'react-icons/bi';
import { BsX } from 'react-icons/bs';
import { DebouncedInput, DivComponent, useSbaaTableContext } from '..';

export const SbaaTableSearch: DivComponent = (props) => {
  const { children, ...rest } = props;
  const {
    table,
    showSettings: [showSettings, setShowSettings],
  } = useSbaaTableContext();

  if (!table) {
    return null as any;
  }
  const { globalFilter } = table.getState();
  const { setGlobalFilter } = table;

  return (
    <InputGroup
      css={{
        '&:hover .clear-filter': {
          color: 'var(--chakra-colors-gray-800)',
          transition: '0.3s',
        },
      }}
      maxW="30em"
      {...rest}
    >
      <InputLeftElement pointerEvents="none" color="gray.300">
        <Icon fontSize="1.2em" as={BiSearch} />
      </InputLeftElement>
      <DebouncedInput
        debounce={300}
        borderRadius="100em"
        paddingStart={10}
        paddingEnd={10}
        placeholder="Search"
        value={globalFilter ?? ''}
        onChange={(v) => setGlobalFilter(v)}
      />
      {globalFilter ? (
        <InputRightElement>
          <IconButton
            onClick={() => setGlobalFilter(undefined)}
            className="clear-filter"
            fontSize="xl"
            color="gray.300"
            variant="ghost"
            size="sm"
            borderRadius={'100em'}
            icon={<Icon as={BsX} />}
            aria-label="clear search"
          />
        </InputRightElement>
      ) : null}
    </InputGroup>
  );
};

export const SbaaTableAdvancedButton: ChakraComponent<'button'> = (props) => {
  const { children, onClick, ...rest } = props;
  const {
    table,
    showSettings: [showSettings, setShowSettings],
  } = useSbaaTableContext();

  if (!table) {
    return null as any;
  }

  return (
    <Button
      aria-label="show settings"
      variant="link"
      borderRadius="99em"
      size="xs"
      colorScheme="blue"
      onClick={setShowSettings.toggle}
      {...rest}
    >
      {showSettings ? 'Hide options' : 'More options'}
    </Button>
  );
};
