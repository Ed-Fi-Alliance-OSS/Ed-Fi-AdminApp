import 'reflect-metadata';
import { theme } from '../src/lib/theme';
import { reactRouterParameters, withRouter } from 'storybook-addon-react-router-v6';

export default {
  decorators: [withRouter],

  parameters: {
    reactRouter: reactRouterParameters({}),
    chakra: {
      theme,
    },
  },

  tags: ['autodocs'],
};
