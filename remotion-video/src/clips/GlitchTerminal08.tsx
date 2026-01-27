import React from "react";
import { GlitchTerminalBase } from "./GlitchTerminalBase";
import { TERMINAL_CONFIGS } from "./terminalConfigs";

export const GlitchTerminal08: React.FC = () => {
  return <GlitchTerminalBase {...TERMINAL_CONFIGS.oracleResolve} />;
};
