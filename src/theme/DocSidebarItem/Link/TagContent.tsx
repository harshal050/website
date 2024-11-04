import React from 'react';

import LinuxIcon from '@site/static/assets/img/platform-linux.svg';
import MacIcon from '@site/static/assets/img/platform-mac.svg';
import WindowsIcon from '@site/static/assets/img/platform-windows.svg';

export default function TagContent(props: { platform: string }) {
  switch (props.platform) {
    case 'windows':
      return <WindowsIcon role="img" title="Available on Windows" />;
    case 'mac':
      return <MacIcon role="img" title="Available on macOS" />;
    case 'linux':
      return <LinuxIcon role="img" title="Available on Linux" />;
    default:
      return <span />;
  }
}
