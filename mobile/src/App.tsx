import { useMemo } from "react";
import type { FC } from "react";

import { TapToPayHomeScreen } from "./screens/TapToPayHomeScreen";
import { parseTapToPayLink } from "./types/tapToPay";

interface AppProps {
  initialUrl?: string | null;
}

const App: FC<AppProps> = ({ initialUrl }) => {
  const handoff = useMemo(() => {
    if (!initialUrl) {
      return null;
    }

    return parseTapToPayLink(initialUrl);
  }, [initialUrl]);

  return <TapToPayHomeScreen handoff={handoff} />;
};

export default App;
