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
export const useNavContext = () => {
  const navContext = useContext(NavContext);
  return { ...navContext, tenantId: navContext.asId };
};

export const useTenantNavContext = () => {
  const navContext = useNavContext();
  if (navContext.asId === undefined) throw new Error('No tenant context');
  return { asId: navContext.asId, tenantId: navContext.asId };
};
export const useSbeNavContext = () => {
  const navContext = useNavContext();
  if (navContext.sbeId === undefined) throw new Error('No sbe context');
  return { ...navContext, sbeId: navContext.sbeId };
};
export const useTenantSbeNavContext = () => {
  const navContext = useNavContext();
  if (navContext.asId === undefined || navContext.sbeId === undefined)
    throw new Error('No tenant or sbe context');
  return { asId: navContext.asId, tenantId: navContext.asId, sbeId: navContext.sbeId };
};
