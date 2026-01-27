import React from "react";
import { GlitchTerminalBase } from "./GlitchTerminalBase";
import { TERMINAL_CONFIGS } from "./terminalConfigs";

export const GlitchTerminal07: React.FC = () => {
  return <GlitchTerminalBase {...TERMINAL_CONFIGS.usd1Token} />;
};
