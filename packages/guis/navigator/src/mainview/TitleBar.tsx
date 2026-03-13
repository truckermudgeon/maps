import type { ReactElement } from 'react';

export interface TitleBarProps {
  ModeSelector: () => ReactElement;
  HelpButton: () => ReactElement;
}

export const TitleBar = (props: TitleBarProps) => {
  const { ModeSelector, HelpButton } = props;

  return (
    <div
      style={{
        padding: '8px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div
        className="electrobun-webkit-app-region-drag"
        style={{ width: 16, height: '100%' }}
      />
      <div
        className="electrobun-webkit-app-region-drag"
        style={{ width: 32, height: '100%' }}
      />
      <div
        className="electrobun-webkit-app-region-drag"
        style={{ height: '100%', flexGrow: 1 }}
      />
      <ModeSelector />
      <div
        className="electrobun-webkit-app-region-drag"
        style={{ height: '100%', flexGrow: 1 }}
      />
      <HelpButton />
      <div
        className="electrobun-webkit-app-region-drag"
        style={{ width: 16, height: '100%' }}
      />
    </div>
  );
};
