import pick from 'lodash/pick';
import { ReactNode, createContext, useContext } from 'react';

const NavContext = createContext<{ asId: number | undefined; sbeId: number | undefined }>({
  asId: undefined,
  sbeId: undefined,
});

/**
 * Provide a subtree with an artificial nav context.
 *
 * Many components are built to be used within a Tenant- and/or SBE-specific
 * context. Most typically this will come from the URL, but it shouldn't have to.
 */
export const NavContextProvider = (props: {
  children: ReactNode;
  /** Override `asId`. Unchanged if omitted (explicit `undefined` does override). */
  asId?: number | undefined;
  /** Override `sbeId`. Unchanged if omitted (explicit `undefined` does override). */
  sbeId?: number | undefined;
}) => {
  const existingContext = useNavContext();
  return (
    <NavContext.Provider value={{ ...existingContext, ...pick(props, ['sbeId', 'asId']) }}>
      {props.children}
    </NavContext.Provider>
  );
};
/**
 * Use nav context.
 *
 * NOTE: do not use router-provided `asId` or `sbeId` directly.
 *
 * Many components are built to be used within a Tenant- and/or SBE-specific
 * setting. Most typically this will come from the URL, but it shouldn't have to.
 */
export const useNavContext = () => useContext(NavContext);
