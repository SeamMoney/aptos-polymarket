import { useState, useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import {
  groupAndSortWallets,
  type AdapterWallet,
  type AdapterNotDetectedWallet,
  APTOS_CONNECT_ACCOUNT_URL
} from '@aptos-labs/wallet-adapter-core';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, ExternalLink } from 'lucide-react';

// Custom wallet icons (override outdated icons from adapters)
// All icons have consistent rounded corners (rx="24-26") for sleek appearance
const WALLET_ICONS: Record<string, string> = {
  // Petra - official logo with P+arrow on purple gradient
  'Petra': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9InVybCgjcGV0cmFfYmcpIi8+CjxwYXRoIGQ9Ik0zMiAyOEg0OFY2OEgzMlYyOFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik00OCAyOEg2OEM3OS4wNDYgMjggODggMzYuOTU0IDg4IDQ4Qzg4IDU5LjA0NiA3OS4wNDYgNjggNjggNjhINDhWMjhaIiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMzIgNjhINDhWMTAwSDMyVjY4WiIgZmlsbD0id2hpdGUiLz4KPHBhdGggZD0iTTQ4IDY4TDk2IDY4TDcyIDEwMEw0OCA2OFoiIGZpbGw9IndoaXRlIi8+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InBldHJhX2JnIiB4MT0iNjQiIHkxPSIwIiB4Mj0iNjQiIHkyPSIxMjgiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agc3RvcC1jb2xvcj0iIzdCNjFGRiIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM1QjVFRjAiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8L3N2Zz4K',
  // Phantom - official logo with rounded corners
  'Phantom': 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik01NS42NDE2IDgyLjE0NzdDNTAuODc0NCA4OS40NTI1IDQyLjg4NjIgOTguNjk2NiAzMi4yNTY4IDk4LjY5NjZDMjcuMjMyIDk4LjY5NjYgMjIuNDAwNCA5Ni42MjggMjIuNDAwNCA4Ny42NDI0QzIyLjQwMDQgNjQuNzU4NCA1My42NDQ1IDI5LjMzMzUgODIuNjMzOSAyOS4zMzM1Qzk5LjEyNTcgMjkuMzMzNSAxMDUuNjk3IDQwLjc3NTUgMTA1LjY5NyA1My43Njg5QzEwNS42OTcgNzAuNDQ3MSA5NC44NzM5IDg5LjUxNzEgODQuMTE1NiA4OS41MTcxQzgwLjcwMTMgODkuNTE3MSA3OS4wMjY0IDg3LjY0MjQgNzkuMDI2NCA4NC42Njg4Qzc5LjAyNjQgODMuODkzMSA3OS4xNTUyIDgzLjA1MjcgNzkuNDEyOSA4Mi4xNDc3Qzc1Ljc0MDkgODguNDE4MiA2OC42NTQ2IDk0LjIzNjEgNjIuMDE5MiA5NC4yMzYxQzU3LjE4NzcgOTQuMjM2MSA1NC43Mzk3IDkxLjE5NzkgNTQuNzM5NyA4Ni45MzE0QzU0LjczOTcgODUuMzc5OSA1NS4wNjE4IDgzLjc2MzggNTUuNjQxNiA4Mi4xNDc3Wk04MC42MTMzIDUzLjMxODJDODAuNjEzMyA1Ny4xMDQ0IDc4LjM3OTUgNTguOTk3NSA3NS44ODA2IDU4Ljk5NzVDNzMuMzQzOCA1OC45OTc1IDcxLjE0NzkgNTcuMTA0NCA3MS4xNDc5IDUzLjMxODJDNzEuMTQ3OSA0OS41MzIgNzMuMzQzOCA0Ny42Mzg5IDc1Ljg4MDYgNDcuNjM4OUM3OC4zNzk1IDQ3LjYzODkgODAuNjEzMyA0OS41MzIgODAuNjEzMyA1My4zMTgyWk05NC44MTAyIDUzLjMxODRDOTQuODEwMiA1Ny4xMDQ2IDkyLjU3NjMgNTguOTk3NyA5MC4wNzc1IDU4Ljk5NzdDODcuNTQwNyA1OC45OTc3IDg1LjM0NDcgNTcuMTA0NiA4NS4zNDQ3IDUzLjMxODRDODUuMzQ0NyA0OS41MzIzIDg3LjU0MDcgNDcuNjM5MiA5MC4wNzc1IDQ3LjYzOTJDOTIuNTc2MyA0Ny42MzkyIDk0LjgxMDIgNDkuNTMyMyA5NC44MTAyIDUzLjMxODRaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPg==',
  'Phantom (Solana)': 'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiB2aWV3Qm94PSIwIDAgMTI4IDEyOCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9IiNBQjlGRjIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik01NS42NDE2IDgyLjE0NzdDNTAuODc0NCA4OS40NTI1IDQyLjg4NjIgOTguNjk2NiAzMi4yNTY4IDk4LjY5NjZDMjcuMjMyIDk4LjY5NjYgMjIuNDAwNCA5Ni42MjggMjIuNDAwNCA4Ny42NDI0QzIyLjQwMDQgNjQuNzU4NCA1My42NDQ1IDI5LjMzMzUgODIuNjMzOSAyOS4zMzM1Qzk5LjEyNTcgMjkuMzMzNSAxMDUuNjk3IDQwLjc3NTUgMTA1LjY5NyA1My43Njg5QzEwNS42OTcgNzAuNDQ3MSA5NC44NzM5IDg5LjUxNzEgODQuMTE1NiA4OS41MTcxQzgwLjcwMTMgODkuNTE3MSA3OS4wMjY0IDg3LjY0MjQgNzkuMDI2NCA4NC42Njg4Qzc5LjAyNjQgODMuODkzMSA3OS4xNTUyIDgzLjA1MjcgNzkuNDEyOSA4Mi4xNDc3Qzc1Ljc0MDkgODguNDE4MiA2OC42NTQ2IDk0LjIzNjEgNjIuMDE5MiA5NC4yMzYxQzU3LjE4NzcgOTQuMjM2MSA1NC43Mzk3IDkxLjE5NzkgNTQuNzM5NyA4Ni45MzE0QzU0LjczOTcgODUuMzc5OSA1NS4wNjE4IDgzLjc2MzggNTUuNjQxNiA4Mi4xNDc3Wk04MC42MTMzIDUzLjMxODJDODAuNjEzMyA1Ny4xMDQ0IDc4LjM3OTUgNTguOTk3NSA3NS44ODA2IDU4Ljk5NzVDNzMuMzQzOCA1OC45OTc1IDcxLjE0NzkgNTcuMTA0NCA3MS4xNDc5IDUzLjMxODJDNzEuMTQ3OSA0OS41MzIgNzMuMzQzOCA0Ny42Mzg5IDc1Ljg4MDYgNDcuNjM4OUM3OC4zNzk1IDQ3LjYzODkgODAuNjEzMyA0OS41MzIgODAuNjEzMyA1My4zMTgyWk05NC44MTAyIDUzLjMxODRDOTQuODEwMiA1Ny4xMDQ2IDkyLjU3NjMgNTguOTk3NyA5MC4wNzc1IDU4Ljk5NzdDODcuNTQwNyA1OC45OTc3IDg1LjM0NDcgNTcuMTA0NiA4NS4zNDQ3IDUzLjMxODRDODUuMzQ0NyA0OS41MzIzIDg3LjU0MDcgNDcuNjM5MiA5MC4wNzc1IDQ3LjYzOTJDOTIuNTc2MyA0Ny42MzkyIDk0LjgxMDIgNDkuNTMyMyA5NC44MTAyIDUzLjMxODRaIiBmaWxsPSIjRkZGREY4Ii8+Cjwvc3ZnPg==',
  // MetaMask with rounded corners
  'MetaMask (Ethereum)': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiByeD0iMjYiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xMDkuMjc0IDE5LjU4NThMNzAuNTIgNDguNDI5N0w3OC4yNDIgMzEuMjcxOEwxMDkuMjc0IDE5LjU4NThaIiBmaWxsPSIjRTI3NjFCIiBzdHJva2U9IiNFMjc2MUIiIHN0cm9rZS13aWR0aD0iMC41Ii8+CjxwYXRoIGQ9Ik0xOC43MjU5IDE5LjU4NThMNTcuMTY1IDQ4LjcxMTdMNDkuNzU4MSAzMS4yNzE4TDE4LjcyNTkgMTkuNTg1OFoiIGZpbGw9IiNFNDc2MUIiIHN0cm9rZT0iI0U0NzYxQiIgc3Ryb2tlLXdpZHRoPSIwLjUiLz4KPHBhdGggZD0iTTk1LjAyMTkgODIuNDM1TDg0LjQzMjkgOTguMzExNkwxMDYuNzk5IDEwNC43MjVMMTEzLjQ5OCA4Mi43MTdMOTUuMDIxOSA4Mi40MzVaIiBmaWxsPSIjRTQ3NjFCIiBzdHJva2U9IiNFNDc2MUIiIHN0cm9rZS13aWR0aD0iMC41Ii8+CjxwYXRoIGQ9Ik0xNC41MDE5IDgyLjcxN0wyMS4yMDEgMTA0LjcyNUw0My41NjcgOTguMzExNkwzMi45NzggODIuNDM1TDE0LjUwMTkgODIuNzE3WiIgZmlsbD0iI0U0NzYxQiIgc3Ryb2tlPSIjRTQ3NjFCIiBzdHJva2Utd2lkdGg9IjAuNSIvPgo8cGF0aCBkPSJNNDIuMTY0OSA1Ni4yNDQ0TDM1LjY1MTkgNjYuMjM3Mkw1Ny43MzQgNjcuMjQyOUw1Ni45NTM5IDQzLjUyMTVMNDIuMTY0OSA1Ni4yNDQ0WiIgZmlsbD0iI0U0NzYxQiIgc3Ryb2tlPSIjRTQ3NjFCIiBzdHJva2Utd2lkdGg9IjAuNSIvPgo8cGF0aCBkPSJNODUuODM1IDU2LjI0NDRMNzAuNzY0IDQzLjI0MDFMNzAuMjY2IDY3LjI0MjlMOTIuMzQ4IDY2LjIzNzJMODUuODM1IDU2LjI0NDRaIiBmaWxsPSIjRTQ3NjFCIiBzdHJva2U9IiNFNDc2MUIiIHN0cm9rZS13aWR0aD0iMC41Ii8+CjxwYXRoIGQ9Ik00My41NjcgOTguMzExNkw1Ni4zODkgOTEuOTY5M0w0NS4yMzc5IDgyLjg1ODdMNDMuNTY3IDk4LjMxMTZaIiBmaWxsPSIjRTQ3NjFCIiBzdHJva2U9IiNFNDc2MUIiIHN0cm9rZS13aWR0aD0iMC41Ii8+CjxwYXRoIGQ9Ik03MS42MTEgOTEuOTY5M0w4NC40MzI5IDk4LjMxMTZMODIuNzYyIDgyLjg1ODdMNzEuNjExIDkxLjk2OTNaIiBmaWxsPSIjRTQ3NjFCIiBzdHJva2U9IiNFNDc2MUIiIHN0cm9rZS13aWR0aD0iMC41Ii8+Cjwvc3ZnPg==',
  // Rainbow - official logo with rounded corners
  'Rainbow (Ethereum)': 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDEyMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIiByeD0iMjQiIGZpbGw9IiMwRTc2RkQiLz4KPHBhdGggZD0iTTIwIDM4QzIwIDI3LjUwNjYgMjguNTA2NiAxOSAzOSAxOUg4MUM5MS40OTM0IDE5IDEwMCAyNy41MDY2IDEwMCAzOFY4MkMxMDAgOTIuNDkzNCA5MS40OTM0IDEwMSA4MSAxMDFIMzlDMjguNTA2NiAxMDEgMjAgOTIuNDkzNCAyMCA4MlYzOFoiIGZpbGw9InVybCgjcGFpbnQwX2xpbmVhcikiLz4KPHBhdGggZD0iTTI1IDUwQzI1IDM2LjE5MjkgMzYuMTkyOSAyNSA1MCAyNUg3MEM4My44MDcxIDI1IDk1IDM2LjE5MjkgOTUgNTBWNzBDOTUgODMuODA3MSA4My44MDcxIDk1IDcwIDk1SDUwQzM2LjE5MjkgOTUgMjUgODMuODA3MSAyNSA3MFY1MFoiIGZpbGw9InVybCgjcGFpbnQxX2xpbmVhcikiLz4KPHBhdGggZD0iTTM1IDU1QzM1IDQ2LjcxNTcgNDEuNzE1NyA0MCA1MCA0MEg3MEM3OC4yODQzIDQwIDg1IDQ2LjcxNTcgODUgNTVWNjVDODUgNzMuMjg0MyA3OC4yODQzIDgwIDcwIDgwSDUwQzQxLjcxNTcgODAgMzUgNzMuMjg0MyAzNSA2NVY1NVoiIGZpbGw9InVybCgjcGFpbnQyX2xpbmVhcikiLz4KPHBhdGggZD0iTTQ1IDYwQzQ1IDU0LjQ3NzIgNDkuNDc3MiA1MCA1NSA1MEg2NUM3MC41MjI4IDUwIDc1IDU0LjQ3NzIgNzUgNjBDNzUgNjUuNTIyOCA3MC41MjI4IDcwIDY1IDcwSDU1QzQ5LjQ3NzIgNzAgNDUgNjUuNTIyOCA0NSA2MFoiIGZpbGw9IiMwRTc2RkQiLz4KPGRlZnM+CjxsaW5lYXJHcmFkaWVudCBpZD0icGFpbnQwX2xpbmVhciIgeDE9IjYwIiB5MT0iMTkiIHgyPSI2MCIgeTI9IjEwMSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjRkY1MzAwIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iI0ZGOTkwMCIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50MV9saW5lYXIiIHgxPSI2MCIgeTE9IjI1IiB4Mj0iNjAiIHkyPSI5NSIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjRkYwMEZGIi8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzAwQkZGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InBhaW50Ml9saW5lYXIiIHgxPSI2MCIgeTE9IjQwIiB4Mj0iNjAiIHkyPSI4MCIgZ3JhZGllbnRVbml0cz0idXNlclNwYWNlT25Vc2UiPgo8c3RvcCBzdG9wLWNvbG9yPSIjMDBGRjk0Ii8+CjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzAwRkZGRiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+Cjwvc3ZnPgo=',
};

// Helper to get wallet icon
export const getWalletIcon = (walletName: string, fallbackIcon?: string): string => {
  return WALLET_ICONS[walletName] || WALLET_ICONS[walletName.replace(' (Solana)', '').replace(' (Ethereum)', '')] || fallbackIcon || '';
};

interface WalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Google icon SVG
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// Apple icon SVG
const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

// Aptos Connect Button for social login
function AptosConnectButton({
  wallet,
  onConnect,
  connecting,
}: {
  wallet: AdapterWallet;
  onConnect: () => void;
  connecting: boolean;
}) {
  const isGoogle = wallet.name.toLowerCase().includes('google');
  const isApple = wallet.name.toLowerCase().includes('apple');

  return (
    <button
      onClick={onConnect}
      disabled={connecting}
      className="w-full flex items-center justify-center gap-3 p-3 bg-white hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50 border border-gray-200"
    >
      {isGoogle && <GoogleIcon />}
      {isApple && <AppleIcon />}
      <span className="text-gray-900 font-medium">
        {isGoogle ? 'Continue with Google' : isApple ? 'Continue with Apple' : wallet.name}
      </span>
      {connecting && <Loader2 size={18} className="text-gray-500 animate-spin" />}
    </button>
  );
}

// Regular wallet button
function WalletButton({
  wallet,
  onConnect,
  connecting,
  isInstalled,
}: {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
  onConnect: () => void;
  connecting: boolean;
  isInstalled: boolean;
}) {
  const handleClick = () => {
    if (isInstalled) {
      onConnect();
    } else if (wallet.url) {
      window.open(wallet.url, '_blank');
    }
  };

  // Get chain label from wallet name
  const getChainLabel = () => {
    if (wallet.name.includes('Solana')) return 'Solana';
    if (wallet.name.includes('Ethereum')) return 'Ethereum';
    return null;
  };

  const chainLabel = getChainLabel();
  const displayName = wallet.name.replace(' (Solana)', '').replace(' (Ethereum)', '');
  const walletIcon = WALLET_ICONS[wallet.name] || WALLET_ICONS[displayName] || wallet.icon;

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className="w-full flex items-center gap-3 p-3 bg-[#1c2b3a] hover:bg-[#2a3d4e] rounded-xl transition-colors disabled:opacity-50"
    >
      {walletIcon ? (
        <img
          src={walletIcon}
          alt={wallet.name}
          className={`w-10 h-10 rounded-xl ${!isInstalled ? 'opacity-50' : ''}`}
        />
      ) : (
        <div className={`w-10 h-10 rounded-xl bg-[#3a4f60] flex items-center justify-center ${!isInstalled ? 'opacity-50' : ''}`}>
          <span className="text-white font-bold">{displayName[0]}</span>
        </div>
      )}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`text-white font-medium ${!isInstalled ? 'opacity-50' : ''}`}>
            {displayName}
          </span>
          {chainLabel && (
            <span className="text-[10px] text-[#8297a3]">({chainLabel})</span>
          )}
        </div>
      </div>
      {isInstalled ? (
        <span className="px-3 py-1.5 bg-[#60a5fa] hover:bg-[#3b82f6] text-white text-sm font-medium rounded-lg">
          Connect
        </span>
      ) : (
        <span className="px-3 py-1.5 text-[#60a5fa] text-sm font-medium flex items-center gap-1">
          Install <ExternalLink size={12} />
        </span>
      )}
      {connecting && <Loader2 size={18} className="text-[#60a5fa] animate-spin" />}
    </button>
  );
}

export function WalletSelector({ isOpen, onClose }: WalletSelectorProps) {
  const { wallets, connect, connected } = useWallet();
  const [connectingWallet, setConnectingWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Close modal when connected
  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen, onClose]);

  // Use the official groupAndSortWallets function from wallet adapter
  const { aptosConnectWallets, availableWallets, installableWallets } = groupAndSortWallets(
    wallets || []
  );

  // Separate cross-chain wallets (Solana/Ethereum) from Aptos wallets
  const aptosWallets = availableWallets.filter(w =>
    !w.name.includes('Solana') && !w.name.includes('Ethereum')
  );
  const solanaWallets = availableWallets.filter(w => w.name.includes('Solana'));
  const ethereumWallets = availableWallets.filter(w => w.name.includes('Ethereum'));

  const aptosInstallable = installableWallets.filter(w =>
    !w.name.includes('Solana') && !w.name.includes('Ethereum')
  );
  const solanaInstallable = installableWallets.filter(w => w.name.includes('Solana'));
  const ethereumInstallable = installableWallets.filter(w => w.name.includes('Ethereum'));

  // IMPORTANT: Safari blocks popups if there's ANY async operation between
  // the user click and window.open(). We must call connect() IMMEDIATELY
  // without any state updates first to prevent popup blocking.
  // The connect() function returns void - async handling is internal.
  // Errors are handled via the onError callback in the provider.
  const handleConnect = (walletName: string) => {
    // Clear any previous error
    setError(null);

    // Call connect IMMEDIATELY - this must be the first thing that happens
    // after the user click to prevent Safari popup blocking
    connect(walletName);

    // Now we can safely update UI state
    setConnectingWallet(walletName);

    // The useEffect watching `connected` will close the modal on success
    // Errors are caught by the provider's onError callback
    // We'll clear the connecting state after a timeout as a fallback
    setTimeout(() => {
      setConnectingWallet(null);
    }, 15000); // 15 second timeout for slow connections
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md bg-[#1c2b3a] border-2 border-[#3a4f60] rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 pb-4">
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] bg-gradient-to-b from-[#60a5fa]/20 via-[#22c55e]/10 to-transparent rounded-full blur-3xl" />
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-[#2a3d4e] rounded-lg transition-colors"
            >
              <X size={20} color="#8297a3" />
            </button>

            <div className="relative text-center mb-2">
              <h2 className="text-xl font-bold text-white">Connect to Polymarket</h2>
              <p className="text-[#8297a3] text-sm mt-2">
                Sign in with your social account or connect a wallet
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-6 mb-4">
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Wallet List */}
          <div className="px-6 pb-6 max-h-[400px] overflow-y-auto">
            <div className="space-y-3">
              {/* Social Login (Aptos Connect) */}
              {aptosConnectWallets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider mb-2">
                    Quick Sign In
                  </div>
                  {aptosConnectWallets.map(wallet => (
                    <AptosConnectButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                    />
                  ))}

                  <div className="flex items-center gap-3 py-2">
                    <div className="flex-1 h-px bg-[#3a4f60]" />
                    <span className="text-xs text-[#6b7a8a]">or connect wallet</span>
                    <div className="flex-1 h-px bg-[#3a4f60]" />
                  </div>
                </div>
              )}

              {/* Aptos Wallets */}
              {aptosWallets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider">
                    Aptos Wallets
                  </div>
                  {aptosWallets.map(wallet => (
                    <WalletButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                      isInstalled={true}
                    />
                  ))}
                </div>
              )}

              {/* Solana Wallets (X-Chain) */}
              {solanaWallets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider flex items-center gap-2">
                    Solana Wallets
                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[8px] rounded">X-CHAIN</span>
                  </div>
                  {solanaWallets.map(wallet => (
                    <WalletButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                      isInstalled={true}
                    />
                  ))}
                </div>
              )}

              {/* Ethereum Wallets (X-Chain) */}
              {ethereumWallets.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider flex items-center gap-2">
                    Ethereum Wallets
                    <span className="px-1.5 py-0.5 bg-orange-500/20 text-orange-400 text-[8px] rounded">X-CHAIN</span>
                  </div>
                  {ethereumWallets.map(wallet => (
                    <WalletButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                      isInstalled={true}
                    />
                  ))}
                </div>
              )}

              {/* Installable Wallets */}
              {(aptosInstallable.length > 0 || solanaInstallable.length > 0 || ethereumInstallable.length > 0) && (
                <div className="space-y-2 pt-2">
                  <div className="text-[10px] text-[#6b7a8a] uppercase tracking-wider">
                    Available to Install
                  </div>
                  {[...aptosInstallable, ...solanaInstallable, ...ethereumInstallable].slice(0, 4).map(wallet => (
                    <WalletButton
                      key={wallet.name}
                      wallet={wallet}
                      onConnect={() => handleConnect(wallet.name)}
                      connecting={connectingWallet === wallet.name}
                      isInstalled={false}
                    />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {aptosConnectWallets.length === 0 && availableWallets.length === 0 && installableWallets.length === 0 && (
                <div className="text-center py-8 text-[#6b7a8a]">
                  No wallets available
                </div>
              )}
            </div>
          </div>

          {/* Footer with Aptos Connect link */}
          {aptosConnectWallets.length > 0 && (
            <div className="px-6 py-3 border-t border-[#3a4f60] bg-[#1c2b3a]/50">
              <a
                href={APTOS_CONNECT_ACCOUNT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#60a5fa] hover:text-[#3b82f6] flex items-center justify-center gap-1"
              >
                Learn more about Aptos Connect
                <ExternalLink size={10} />
              </a>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default WalletSelector;
