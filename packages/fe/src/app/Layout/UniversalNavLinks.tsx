import { useLocation, useMatches } from 'react-router-dom';
import { NavButton } from './NavButton';
import { Icons } from '@edanalytics/common-ui';

export const UniversalNavLinks = (props: object) => {
  const currentMatches = useMatches();
  const path = useLocation().pathname;
  return (
    <>
      <NavButton
        {...{
          route: '/',
          icon: Icons.Home,
          text: 'Home',
          isActive: /^\/(as\/\d+\/?)?$/.test(path),
        }}
      />
      <NavButton
        {...{
          route: '/account',
          icon: Icons.Account,
          text: 'Account',
          isActive: currentMatches.some((m) => m.pathname.startsWith('/account')),
        }}
      />
    </>
  );
};
