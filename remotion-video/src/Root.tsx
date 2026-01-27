import { Composition } from "remotion";
import { TheOutage } from "./TheOutage";
import { EncryptedMempool } from "./EncryptedMempool";
import { CinematicEncryptedMempool } from "./CinematicEncryptedMempool";
import { EpicEncryptedMempool } from "./EpicEncryptedMempool";
import { UltraEncryptedMempool } from "./UltraEncryptedMempool";
import { PolymarketEncrypted } from "./PolymarketEncrypted";

// Short clips
import { TPSRace } from "./clips/TPSRace";
import { BlockSTM } from "./clips/BlockSTM";
import { GasSpike } from "./clips/GasSpike";
import { SubSecondFinality } from "./clips/SubSecondFinality";
import { Raptr4Hop } from "./clips/Raptr4Hop";
import { CompleteSets } from "./clips/CompleteSets";
import { OutageTimeline } from "./clips/OutageTimeline";
import { ValidatorNetwork } from "./clips/ValidatorNetwork";

// iPhone UI Showcases
import { iPhoneHomeScreen } from "./clips/iPhoneHomeScreen";
import { iPhoneMarketDetail } from "./clips/iPhoneMarketDetail";
import { iPhoneTradingFlow } from "./clips/iPhoneTradingFlow";
import { iPhoneAppTour } from "./clips/iPhoneAppTour";
import { iPhoneDualScreen } from "./clips/iPhoneDualScreen";
import { iPhoneScrollShowcase } from "./clips/iPhoneScrollShowcase";

// Futuristic Terminal Code Showcases
import { FuturisticTerminal1 } from "./clips/FuturisticTerminal1";
import { FuturisticTerminal2 } from "./clips/FuturisticTerminal2";
import { FuturisticTerminal3 } from "./clips/FuturisticTerminal3";
import { FuturisticTerminal4 } from "./clips/FuturisticTerminal4";
import { FuturisticTerminal5 } from "./clips/FuturisticTerminal5";
import { FuturisticTerminal6 } from "./clips/FuturisticTerminal6";
import { FuturisticTerminal7 } from "./clips/FuturisticTerminal7";
import { FuturisticTerminal8 } from "./clips/FuturisticTerminal8";
import { FuturisticTerminal9 } from "./clips/FuturisticTerminal9";
import { FuturisticTerminal10 } from "./clips/FuturisticTerminal10";
import { FuturisticTerminal11 } from "./clips/FuturisticTerminal11";
import { FuturisticTerminal12 } from "./clips/FuturisticTerminal12";

// Enhanced Glitch Terminal Showcases (with animations, trades, compiler, prover, security)
import { GlitchTerminal1 } from "./clips/GlitchTerminal1";
import { GlitchTerminal2 } from "./clips/GlitchTerminal2";
import { GlitchTerminal3 } from "./clips/GlitchTerminal3";
import { GlitchTerminal4 } from "./clips/GlitchTerminal4";
import { GlitchTerminal5 } from "./clips/GlitchTerminal5";
import { GlitchTerminal6 } from "./clips/GlitchTerminal6";
import { GlitchTerminal7 } from "./clips/GlitchTerminal7";
import { GlitchTerminal8 } from "./clips/GlitchTerminal8";
import { GlitchTerminal9 } from "./clips/GlitchTerminal9";
import { GlitchTerminal10 } from "./clips/GlitchTerminal10";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* ================================================================== */}
      {/* FULL LENGTH VIDEOS */}
      {/* ================================================================== */}

      {/* Version 1: "The Outage" - Contrast story showing Polymarket down vs Aptos speed */}
      <Composition
        id="TheOutage"
        component={TheOutage}
        durationInFrames={30 * 35} // 35 seconds - EPIC VERSION
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Encrypted Mempool - Basic Animation */}
      <Composition
        id="EncryptedMempool"
        component={EncryptedMempool}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* CINEMATIC Encrypted Mempool - Production Quality */}
      <Composition
        id="CinematicEncryptedMempool"
        component={CinematicEncryptedMempool}
        durationInFrames={30 * 33} // 33 seconds (sum of all scene durations)
        fps={30}
        width={1920}
        height={1080}
      />

      {/* EPIC Animated Encrypted Mempool - Real Motion Graphics */}
      <Composition
        id="EpicEncryptedMempool"
        component={EpicEncryptedMempool}
        durationInFrames={30 * 21} // 21 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* ULTRA Encrypted Mempool - Production Quality with Cinematic Backgrounds */}
      <Composition
        id="UltraEncryptedMempool"
        component={UltraEncryptedMempool}
        durationInFrames={30 * 45} // 45 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* POLYMARKET x APTOS - The definitive encrypted mempool story */}
      <Composition
        id="PolymarketEncrypted"
        component={PolymarketEncrypted}
        durationInFrames={30 * 55} // 55 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* ================================================================== */}
      {/* SHORT CLIPS (15-20 seconds each) */}
      {/* ================================================================== */}

      {/* TPS Race - Blockchain speed comparison */}
      <Composition
        id="TPSRace"
        component={TPSRace}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Block-STM - Parallel execution explainer */}
      <Composition
        id="BlockSTM"
        component={BlockSTM}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Gas Spike - The 47x explosion */}
      <Composition
        id="GasSpike"
        component={GasSpike}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Sub-Second Finality - Speed comparison */}
      <Composition
        id="SubSecondFinality"
        component={SubSecondFinality}
        durationInFrames={30 * 15} // 15 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Raptr 4-Hop - Consensus mechanism */}
      <Composition
        id="Raptr4Hop"
        component={Raptr4Hop}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Complete Sets - Prediction market mechanics */}
      <Composition
        id="CompleteSets"
        component={CompleteSets}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Outage Timeline - Polygon failures */}
      <Composition
        id="OutageTimeline"
        component={OutageTimeline}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Validator Network - Global distribution */}
      <Composition
        id="ValidatorNetwork"
        component={ValidatorNetwork}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* ================================================================== */}
      {/* iPHONE UI SHOWCASES */}
      {/* ================================================================== */}

      {/* iPhone Home Screen - Markets listing with 3D phone */}
      <Composition
        id="iPhoneHomeScreen"
        component={iPhoneHomeScreen}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* iPhone Market Detail - Market page with price animation */}
      <Composition
        id="iPhoneMarketDetail"
        component={iPhoneMarketDetail}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* iPhone Trading Flow - Step-by-step trading UX */}
      <Composition
        id="iPhoneTradingFlow"
        component={iPhoneTradingFlow}
        durationInFrames={30 * 25} // 25 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* iPhone App Tour - Carousel through all screens */}
      <Composition
        id="iPhoneAppTour"
        component={iPhoneAppTour}
        durationInFrames={30 * 30} // 30 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* iPhone Dual Screen - Side-by-side browse to trade */}
      <Composition
        id="iPhoneDualScreen"
        component={iPhoneDualScreen}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* iPhone Scroll Showcase - Smooth scroll through app */}
      <Composition
        id="iPhoneScrollShowcase"
        component={iPhoneScrollShowcase}
        durationInFrames={30 * 25} // 25 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* ================================================================== */}
      {/* FUTURISTIC TERMINAL CODE SHOWCASES */}
      {/* ================================================================== */}

      {/* Terminal 1 - Holographic buy_outcome */}
      <Composition
        id="FuturisticTerminal1"
        component={FuturisticTerminal1}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 2 - Matrix rain create_multi_market */}
      <Composition
        id="FuturisticTerminal2"
        component={FuturisticTerminal2}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 3 - Cyberpunk neon sell_outcome */}
      <Composition
        id="FuturisticTerminal3"
        component={FuturisticTerminal3}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 4 - Holographic USD1 stablecoin */}
      <Composition
        id="FuturisticTerminal4"
        component={FuturisticTerminal4}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 5 - Retro CRT CPMM formulas */}
      <Composition
        id="FuturisticTerminal5"
        component={FuturisticTerminal5}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 6 - Neural network Aggregator_v2 */}
      <Composition
        id="FuturisticTerminal6"
        component={FuturisticTerminal6}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 7 - Tron-inspired resolve_market */}
      <Composition
        id="FuturisticTerminal7"
        component={FuturisticTerminal7}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 8 - Synthwave claim_winnings */}
      <Composition
        id="FuturisticTerminal8"
        component={FuturisticTerminal8}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 9 - Glass/Frosted MultiMarket struct */}
      <Composition
        id="FuturisticTerminal9"
        component={FuturisticTerminal9}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 10 - Glitch mint_complete_set */}
      <Composition
        id="FuturisticTerminal10"
        component={FuturisticTerminal10}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 11 - Brutalist OutcomeMarket struct */}
      <Composition
        id="FuturisticTerminal11"
        component={FuturisticTerminal11}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Terminal 12 - Sci-fi hologram fee_calculation */}
      <Composition
        id="FuturisticTerminal12"
        component={FuturisticTerminal12}
        durationInFrames={30 * 18} // 18 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* ================================================================== */}
      {/* ENHANCED GLITCH TERMINALS (with live trades, compiler, prover, PnL) */}
      {/* ================================================================== */}

      {/* Glitch Terminal 1 - buy_outcome with live trades */}
      <Composition
        id="GlitchTerminal1"
        component={GlitchTerminal1}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Glitch Terminal 2 - sell_outcome with live trades */}
      <Composition
        id="GlitchTerminal2"
        component={GlitchTerminal2}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Glitch Terminal 3 - create_multi_market with prover */}
      <Composition
        id="GlitchTerminal3"
        component={GlitchTerminal3}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Glitch Terminal 4 - mint_complete_set with prover */}
      <Composition
        id="GlitchTerminal4"
        component={GlitchTerminal4}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Glitch Terminal 5 - claim_winnings with security */}
      <Composition
        id="GlitchTerminal5"
        component={GlitchTerminal5}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Glitch Terminal 6 - Aggregator_v2 parallelization */}
      <Composition
        id="GlitchTerminal6"
        component={GlitchTerminal6}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Glitch Terminal 7 - USD1 Stablecoin */}
      <Composition
        id="GlitchTerminal7"
        component={GlitchTerminal7}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Glitch Terminal 8 - Oracle resolve_market */}
      <Composition
        id="GlitchTerminal8"
        component={GlitchTerminal8}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Glitch Terminal 9 - Fee Calculation */}
      <Composition
        id="GlitchTerminal9"
        component={GlitchTerminal9}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />

      {/* Glitch Terminal 10 - CPMM Pricing */}
      <Composition
        id="GlitchTerminal10"
        component={GlitchTerminal10}
        durationInFrames={30 * 20} // 20 seconds
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
