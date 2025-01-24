import '@fontsource/inter';
import { CssBaseline, CssVarsProvider, useColorScheme } from '@mui/joy';
import {
  THEME_ID as MATERIAL_THEME_ID,
  Experimental_CssVarsProvider as MaterialCssVarsProvider,
  experimental_extendTheme as materialExtendTheme,
} from '@mui/material/styles';
import type { Preview, StoryContext } from '@storybook/react';
import type { ReactNode } from 'react';
import * as React from 'react';
import { useEffect } from 'react';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },

  //tags: ['autodocs'],
};

export const globalTypes = {
  theme: {
    name: 'Theme',
    title: 'Theme',
    defaultValue: 'light',
    toolbar: {
      icon: 'paintbrush',
      dynamicTitle: true,
      items: [
        { value: 'light', title: 'Light mode' },
        { value: 'dark', title: 'Dark mode' },
      ],
    },
  },
};

const materialTheme = materialExtendTheme();

export const decorators = [
  (Story: () => React.JSX.Element, context: StoryContext) => {
    const { theme } = context.globals;

    return (
      <MaterialCssVarsProvider theme={{ [MATERIAL_THEME_ID]: materialTheme }}>
        <CssVarsProvider>
          <CssBaseline />
          <ThemedStoryWrapper theme={theme as 'light' | 'dark'}>
            <Story />
          </ThemedStoryWrapper>
        </CssVarsProvider>
      </MaterialCssVarsProvider>
    );
  },
];

const ThemedStoryWrapper = (props: {
  children?: ReactNode;
  theme: 'light' | 'dark';
}) => {
  const { setMode } = useColorScheme();
  useEffect(() => setMode(props.theme), [props.theme, setMode]);

  return <>{props.children}</>;
};

export default preview;
