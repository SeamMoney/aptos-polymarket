import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { X } from "lucide-react";

// Polymarket Logo SVG
function PolymarketLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 12C0 5.37258 5.37258 0 12 0H36C42.6274 0 48 5.37258 48 12V36C48 42.6274 42.6274 48 36 48H12C5.37258 48 0 42.6274 0 36V12Z" fill="#0060FF" />
      <path fillRule="evenodd" clipRule="evenodd" d="M34.6148 9.94128V38.0587L11.8853 31.2882V16.7118L34.6148 9.94128ZM13.8921 18.8288V29.1712L30.2773 24L13.8921 18.8288ZM32.6079 25.3689L16.3106 30.5124L32.6079 35.3669V25.3689ZM32.6079 22.6311L16.3106 17.4876L32.6079 12.6331V22.6311Z" fill="white" />
    </svg>
  );
}

// Google Icon
function GoogleIcon() {
  return (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 488 512" className="w-4 h-4" xmlns="http://www.w3.org/2000/svg">
      <path d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
    </svg>
  );
}

// MetaMask Fox Icon
function MetaMaskIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 142 136.878" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M132.682,132.192l-30.583-9.106l-23.063,13.787l-16.092-0.007l-23.077-13.78l-30.569,9.106L0,100.801l9.299-34.839L0,36.507L9.299,0l47.766,28.538h27.85L132.682,0l9.299,36.507l-9.299,29.455l9.299,34.839L132.682,132.192L132.682,132.192z" fill="#FF5C16" />
      <path d="M9.305,0l47.767,28.558l-1.899,19.599L9.305,0z M39.875,100.814l21.017,16.01l-21.017,6.261C39.875,123.085,39.875,100.814,39.875,100.814z M59.212,74.345l-4.039-26.174L29.317,65.97l-0.014-0.007v0.013l0.08,18.321l10.485-9.951L59.212,74.345L59.212,74.345z M132.682,0L84.915,28.558l1.893,19.599L132.682,0z M102.113,100.814l-21.018,16.01l21.018,6.261V100.814z M112.678,65.975h0.007H112.678v-0.013l-0.006,0.007L86.815,48.171l-4.039,26.174h19.336l10.492,9.95C112.604,84.295,112.678,65.975,112.678,65.975z" fill="#FF5C16" />
      <path d="M39.868,123.085l-30.569,9.106L0,100.814h39.868C39.868,100.814,39.868,123.085,39.868,123.085z M59.205,74.338l5.839,37.84l-8.093-21.04L29.37,84.295l10.491-9.956h19.344L59.205,74.338z M102.112,123.085l30.57,9.106l9.299-31.378h-39.869C102.112,100.814,102.112,123.085,102.112,123.085z M82.776,74.338l-5.839,37.84l8.092-21.04l27.583-6.843l-10.498-9.956H82.776V74.338z" fill="#E34807" />
      <path d="M0,100.801l9.299-34.839h19.997l0.073,18.327l27.584,6.843l8.092,21.039l-4.16,4.633l-21.017-16.01H0V100.801z M141.981,100.801l-9.299-34.839h-19.998l-0.073,18.327l-27.582,6.843l-8.093,21.039l4.159,4.633l21.018-16.01h39.868V100.801z M84.915,28.538h-27.85l-1.891,19.599l9.872,64.013h11.891l9.878-64.013L84.915,28.538z" fill="#FF8D5D" />
      <path d="M9.299,0L0,36.507l9.299,29.455h19.997l25.87-17.804L9.299,0z M53.426,81.938h-9.059l-4.932,4.835l17.524,4.344l-3.533-9.186V81.938z M132.682,0l9.299,36.507l-9.299,29.455h-19.998L86.815,48.158L132.682,0z M88.568,81.938h9.072l4.932,4.841l-17.544,4.353l3.54-9.201V81.938z M79.029,124.385l2.067-7.567l-4.16-4.633h-11.9l-4.159,4.633l2.066,7.567" fill="#661800" />
      <path d="M79.029,124.384v12.495H62.945v-12.495L79.029,124.384L79.029,124.384z" fill="#C0C4CD" />
      <path d="M39.875,123.072l23.083,13.8v-12.495l-2.067-7.566C60.891,116.811,39.875,123.072,39.875,123.072z M102.113,123.072l-23.084,13.8v-12.495l2.067-7.566C81.096,116.811,102.113,123.072,102.113,123.072z" fill="#E7EBF6" />
    </svg>
  );
}

// Phantom Ghost Icon
function PhantomIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ background: "rgb(171, 159, 242)", borderRadius: "27.5%" }}>
      <path fillRule="evenodd" clipRule="evenodd" d="M37.7425 57.0705C34.1942 62.3362 28.2483 69 20.3366 69C16.5965 69 13.0001 67.5093 13 61.0322C12.9997 44.5362 36.2555 19.0003 57.8334 19C70.1084 18.9998 75 27.2474 75 36.6136C75 48.6357 66.9442 62.3824 58.9368 62.3824C56.3955 62.3824 55.1487 61.031 55.1487 58.888C55.1487 58.3288 55.2442 57.7228 55.4365 57.0705C52.7029 61.5902 47.4285 65.7849 42.4896 65.7849C38.8933 65.7849 37.0713 63.5944 37.0713 60.5187C37.0713 59.4003 37.311 58.2357 37.7425 57.0705ZM53.7586 31.6834C51.8054 31.6868 50.4738 33.2938 50.478 35.5864C50.4822 37.879 51.8198 39.5273 53.7729 39.5241C55.6789 39.5208 57.0099 37.8679 57.0058 35.5752C57.0016 33.2827 55.6646 31.6802 53.7586 31.6834ZM64.1193 31.6725C62.1661 31.6759 60.8345 33.2829 60.8387 35.5755C60.8429 37.868 62.1798 39.5164 64.1336 39.5131C66.0396 39.5099 67.3706 37.8569 67.3664 35.5643C67.3622 33.2718 66.0253 31.6693 64.1193 31.6725Z" fill="#ffffff" />
    </svg>
  );
}

// Rainbow Icon
function RainbowIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 120 120" style={{ borderRadius: "8px" }}>
      <path fill="url(#rainbow-a)" d="M0 0h120v120H0z" />
      <path fill="url(#rainbow-b)" d="M20 38h6c30.928 0 56 25.072 56 56v6h12a6 6 0 0 0 6-6c0-40.87-33.13-74-74-74a6 6 0 0 0-6 6z" />
      <path fill="url(#rainbow-c)" d="M84 94h16a6 6 0 0 1-6 6H84z" />
      <path fill="url(#rainbow-d)" d="M26 20v16h-6V26a6 6 0 0 1 6-6" />
      <path fill="url(#rainbow-e)" d="M20 36h6c32.033 0 58 25.968 58 58v6H66v-6c0-22.091-17.909-40-40-40h-6z" />
      <path fill="url(#rainbow-f)" d="M68 94h16v6H68z" />
      <path fill="url(#rainbow-g)" d="M20 52V36h6v16z" />
      <path fill="url(#rainbow-h)" d="M20 62a6 6 0 0 0 6 6c14.36 0 26 11.64 26 26a6 6 0 0 0 6 6h10v-6c0-23.196-18.804-42-42-42h-6z" />
      <path fill="url(#rainbow-i)" d="M52 94h16v6H58a6 6 0 0 1-6-6" />
      <path fill="url(#rainbow-j)" d="M26 68a6 6 0 0 1-6-6V52h6z" />
      <defs>
        <radialGradient id="rainbow-b" cx="0" cy="0" r="1" gradientTransform="matrix(0 -74 74 0 26 94)" gradientUnits="userSpaceOnUse">
          <stop offset="0.77" stopColor="#FF4000" />
          <stop offset="1" stopColor="#8754C9" />
        </radialGradient>
        <radialGradient id="rainbow-e" cx="0" cy="0" r="1" gradientTransform="matrix(0 -58 58 0 26 94)" gradientUnits="userSpaceOnUse">
          <stop offset="0.724" stopColor="#FFF700" />
          <stop offset="1" stopColor="#FF9901" />
        </radialGradient>
        <radialGradient id="rainbow-h" cx="0" cy="0" r="1" gradientTransform="matrix(0 -42 42 0 26 94)" gradientUnits="userSpaceOnUse">
          <stop offset="0.595" stopColor="#0AF" />
          <stop offset="1" stopColor="#01DA40" />
        </radialGradient>
        <radialGradient id="rainbow-i" cx="0" cy="0" r="1" gradientTransform="matrix(17 0 0 45.3333 51 97)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0AF" />
          <stop offset="1" stopColor="#01DA40" />
        </radialGradient>
        <radialGradient id="rainbow-j" cx="0" cy="0" r="1" gradientTransform="matrix(0 -17 322.37 0 23 69)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0AF" />
          <stop offset="1" stopColor="#01DA40" />
        </radialGradient>
        <linearGradient id="rainbow-a" x1="60" x2="60" y1="0" y2="120" gradientUnits="userSpaceOnUse">
          <stop stopColor="#174299" />
          <stop offset="1" stopColor="#001E59" />
        </linearGradient>
        <linearGradient id="rainbow-c" x1="83" x2="100" y1="97" y2="97" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF4000" />
          <stop offset="1" stopColor="#8754C9" />
        </linearGradient>
        <linearGradient id="rainbow-d" x1="23" x2="23" y1="20" y2="37" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8754C9" />
          <stop offset="1" stopColor="#FF4000" />
        </linearGradient>
        <linearGradient id="rainbow-f" x1="68" x2="84" y1="97" y2="97" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF700" />
          <stop offset="1" stopColor="#FF9901" />
        </linearGradient>
        <linearGradient id="rainbow-g" x1="23" x2="23" y1="52" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFF700" />
          <stop offset="1" stopColor="#FF9901" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Pontem Icon
function PontemIcon() {
  return (
    <img
      alt="Pontem Wallet"
      width="32"
      height="32"
      src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQ4IDhDMjUuOTQwMSA4IDggMjUuOTM2NCA4IDQ3Ljk5MThDOCA2My44NDQxIDE3LjI3MzcgNzcuNTc5NSAzMC42ODM2IDg0LjA0NTFWODQuMDc4SDMwLjc0OTNDMzUuOTY4OCA4Ni41ODg3IDQxLjgyODUgODggNDggODhDNzAuMDU5OSA4OCA4OCA3MC4wNjM2IDg4IDQ4LjAwODJDODggMjUuOTM2NCA3MC4wNTk5IDggNDggOFpNNDggMTEuMjgyMUM2OC4yMzggMTEuMjgyMSA4NC43MTczIDI3Ljc1OCA4NC43MTczIDQ3Ljk5MThDODQuNzE3MyA1My44MDEgODMuMzU0OSA1OS4zMTQ5IDgwLjk0MjEgNjQuMjA1MUM3NS42NTcgNjEuNjQ1MSA3MC4yODk3IDU5Ljc0MTUgNjQuODczMiA1OC40NDUxVjI3LjgyMzZDNjQuODczMiAyNi43NTY5IDY0LjAzNjEgMjUuOTAzNiA2Mi45ODU2IDI1LjkwMzZINTYuMjU2MUgzOS4zMDA4SDMyLjU3MTJDMzEuNTM3MSAyNS45MDM2IDMwLjY4MzYgMjYuNzU2OSAzMC42ODM2IDI3LjgyMzZWNTguNTkyOEMyNS40MzEzIDU5Ljg4OTIgMjAuMjExNyA2MS43NiAxNS4wNzQzIDY0LjIyMTVDMTIuNjQ1MSA1OS4zMTQ5IDExLjI4MjcgNTMuODE3NCAxMS4yODI3IDQ3Ljk5MThDMTEuMjgyNyAyNy43NTggMjcuNzYyIDExLjI4MjEgNDggMTEuMjgyMVpNMTcuMTkxNiA2Ny45MTM4QzIxLjU0MTIgNjUuNzY0MSAyNi4wNTUgNjQuMTA2NyAzMC43IDYyLjk1OFY4MC4zNTI4QzI1LjIwMTUgNzcuNDE1NCAyMC41NTY0IDczLjExNTkgMTcuMTkxNiA2Ny45MTM4Wk0zOS4zMDA4IDgzLjY1MTNWNDIuNjc0OUMzOS4zMDA4IDM3LjkzMjMgNDMuMTkwOCAzNC4wMTAzIDQ3LjgzNTkgMzQuMDEwM0M1Mi40ODA5IDM0LjAxMDMgNTYuMjU2MSAzNy44NTAzIDU2LjI1NjEgNDIuNTc2NEM1Ni4yNTYxIDQyLjYwOTIgNTYuMjM5NiA0Mi42NDIxIDU2LjIzOTYgNDIuNjc0OUg1Ni4yNTYxVjU2LjkzNTRDNTIuMzAwNCA1Ni40NzU5IDQ4LjMyODMgNTYuMzI4MiA0NC4zNTYyIDU2LjU0MTVMNDEuMDg5OSA2MS4yODQxQzQ2LjE3ODEgNjAuODU3NCA1MS4xMzUgNjAuODkwMyA1Ni4wMjYzIDYxLjQ0ODJDNTYuMDc1NSA2MS40NDgyIDU2LjEwODMgNjEuNDQ4MiA1Ni4xNTc2IDYxLjQ2NDZDNTYuMTkwNCA2MS40NjQ2IDU2LjIyMzIgNjEuNDY0NiA1Ni4yNzI1IDYxLjQ4MUM1Ny4xMjYgNjEuNTc5NSA2MC4yMjgxIDYxLjk3MzMgNjMuMDY3NyA2Mi42NzlMNTYuMjcyNSA2NC45OTI4VjgzLjc4MjZDNTMuNjEzNSA4NC4zODk3IDUwLjg1NiA4NC43MzQ0IDQ4LjAzMjggODQuNzM0NEM0NC45OTYzIDg0LjcwMTUgNDIuMDkxMSA4NC4zMjQxIDM5LjMwMDggODMuNjUxM1pNNjQuODU2OCA4MC41ODI2VjYzLjA0QzY5LjQ4NTQgNjQuMjA1MSA3NC4wNjQ4IDY1LjkxMTggNzguNjYwNiA2OC4xNDM2Qzc1LjIxMzggNzMuMzc4NSA3MC40NTM4IDc3LjY3NzkgNjQuODU2OCA4MC41ODI2WiIgZmlsbD0idXJsKCNwYWludDBfbGluZWFyXzE5OTAzXzU3NDYwKSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyXzE5OTAzXzU3NDYwIiB4MT0iNDcuOTk5MyIgeTE9Ijg5LjczMDgiIHgyPSI0Ny45OTkzIiB5Mj0iLTQuMjY2MTciIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj4KPHN0b3Agb2Zmc2V0PSIwLjA4NTgiIHN0b3AtY29sb3I9IiM4RDI5QzEiLz4KPHN0b3Agb2Zmc2V0PSIwLjIzODMiIHN0b3AtY29sb3I9IiM5NDJCQkIiLz4KPHN0b3Agb2Zmc2V0PSIwLjQ2NjciIHN0b3AtY29sb3I9IiNBOTJGQUMiLz4KPHN0b3Agb2Zmc2V0PSIwLjc0MTMiIHN0b3AtY29sb3I9IiNDQTM3OTMiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRjAzRjc3Ii8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg=="
    />
  );
}

// Coinbase Icon
function CoinbaseIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="10" r="10" fill="#0052FF" />
      <rect rx="27%" width="20" height="20" fill="#0052FF" />
      <path fillRule="evenodd" clipRule="evenodd" d="M10.0001 17C13.8661 17 17.0001 13.866 17.0001 10C17.0001 6.13401 13.8661 3 10.0001 3C6.13413 3 3.00012 6.13401 3.00012 10C3.00012 13.866 6.13413 17 10.0001 17ZM8.25012 7.71429C7.95427 7.71429 7.71441 7.95414 7.71441 8.25V11.75C7.71441 12.0459 7.95427 12.2857 8.25012 12.2857H11.7501C12.046 12.2857 12.2858 12.0459 12.2858 11.75V8.25C12.2858 7.95414 12.046 7.71429 11.7501 7.71429H8.25012Z" fill="white" />
    </svg>
  );
}

// WalletConnect Icon
function WalletConnectIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9.58818 11.8556C13.1293 8.31442 18.8706 8.31442 22.4117 11.8556L22.8379 12.2818C23.015 12.4588 23.015 12.7459 22.8379 12.9229L21.3801 14.3808C21.2915 14.4693 21.148 14.4693 21.0595 14.3808L20.473 13.7943C18.0026 11.3239 13.9973 11.3239 11.5269 13.7943L10.8989 14.4223C10.8104 14.5109 10.6668 14.5109 10.5783 14.4223L9.12041 12.9645C8.94336 12.7875 8.94336 12.5004 9.12041 12.3234L9.58818 11.8556ZM25.4268 14.8706L26.7243 16.1682C26.9013 16.3452 26.9013 16.6323 26.7243 16.8093L20.8737 22.6599C20.6966 22.8371 20.4096 22.8371 20.2325 22.6599L16.0802 18.5076C16.0359 18.4634 15.9641 18.4634 15.9199 18.5076L11.7675 22.6599C11.5905 22.8371 11.3034 22.8371 11.1264 22.66C11.1264 22.66 11.1264 22.6599 11.1264 22.6599L5.27561 16.8092C5.09856 16.6322 5.09856 16.3451 5.27561 16.168L6.57313 14.8706C6.75019 14.6934 7.03726 14.6934 7.21431 14.8706L11.3668 19.023C11.411 19.0672 11.4828 19.0672 11.5271 19.023L15.6793 14.8706C15.8563 14.6934 16.1434 14.6934 16.3205 14.8706L20.473 19.023C20.5172 19.0672 20.589 19.0672 20.6332 19.023L24.7856 14.8706C24.9627 14.6935 25.2498 14.6935 25.4268 14.8706Z" fill="#3B99FC" />
    </svg>
  );
}

// Wallet button component
function WalletButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center cursor-pointer active:scale-[97%] transition h-14 w-full p-2 rounded-lg border border-poly-border bg-poly-card hover:bg-poly-cardHover"
    >
      <div className="w-8 h-8 flex items-center justify-center">{children}</div>
    </button>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const handleGoogleLogin = () => {
    // Placeholder for Google OAuth - set logged in state
    localStorage.setItem("polymarket_logged_in", "true");
    navigate("/polymarket");
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      localStorage.setItem("polymarket_logged_in", "true");
      navigate("/polymarket");
    }
  };

  const handleWalletConnect = (walletName: string) => {
    console.log(`${walletName} wallet clicked`);
    localStorage.setItem("polymarket_logged_in", "true");
    navigate("/polymarket");
  };

  const handleClose = () => {
    navigate(-1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-[#1d2b3a] flex flex-col"
    >
      {/* Close button */}
      <div className="p-4">
        <button
          onClick={handleClose}
          className="p-2 -ml-2 hover:opacity-70 transition-opacity"
        >
          <X size={24} color="#8B949E" strokeWidth={2.5} />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center w-full gap-[18px]">
            {/* Logo and title */}
            <div className="flex flex-col items-center gap-[18px]">
              <PolymarketLogo />
              <p className="font-semibold text-xl text-white">
                Welcome to Polymarket
              </p>
            </div>

            {/* Continue with Google button */}
            <button
              onClick={handleGoogleLogin}
              className="cursor-pointer active:scale-[97%] transition whitespace-nowrap rounded-lg text-sm font-medium bg-[#4A90D9] text-white hover:bg-[#3A80C9] px-4 py-2 w-full h-[52px] flex items-center justify-center gap-2.5"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </button>

            {/* OR divider */}
            <div className="flex w-full justify-center items-center my-1 gap-4">
              <div className="flex-1 h-px bg-poly-border" />
              <span className="text-sm font-medium text-poly-textSecondary">OR</span>
              <div className="flex-1 h-px bg-poly-border" />
            </div>

            {/* Email input */}
            <form
              onSubmit={handleEmailSubmit}
              className="relative w-full h-14 border border-poly-border rounded-lg overflow-hidden transition-colors focus-within:border-poly-blue"
            >
              <input
                className="w-full h-full bg-transparent text-white text-sm px-3 pr-[110px] outline-none placeholder-poly-textMuted"
                placeholder="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="absolute right-2 w-full max-w-[90px] top-1/2 -translate-y-1/2 z-10">
                <button
                  type="submit"
                  disabled={!email}
                  className="inline-flex items-center justify-center cursor-pointer transition w-full h-9 text-sm font-medium rounded-md bg-[#4A6A8A] text-white hover:bg-[#5A7A9A] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  Continue
                </button>
              </div>
            </form>

            {/* Wallet buttons grid */}
            <div className="grid flex-1 gap-[18px] w-full grid-cols-3">
              <WalletButton onClick={() => handleWalletConnect("MetaMask")}>
                <MetaMaskIcon />
              </WalletButton>
              <WalletButton onClick={() => handleWalletConnect("Phantom")}>
                <PhantomIcon />
              </WalletButton>
              <WalletButton onClick={() => handleWalletConnect("Rainbow")}>
                <RainbowIcon />
              </WalletButton>
              <WalletButton onClick={() => handleWalletConnect("Pontem")}>
                <PontemIcon />
              </WalletButton>
              <WalletButton onClick={() => handleWalletConnect("Coinbase")}>
                <CoinbaseIcon />
              </WalletButton>
              <WalletButton onClick={() => handleWalletConnect("WalletConnect")}>
                <WalletConnectIcon />
              </WalletButton>
            </div>

            {/* Terms and Privacy */}
            <div className="w-full flex flex-col gap-2">
              <div className="w-full flex justify-center items-center gap-2">
                <a
                  href="/tos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-poly-textSecondary text-xs font-medium transition-all duration-200 hover:underline"
                >
                  Terms
                </a>
                <span className="text-poly-textSecondary text-xs">•</span>
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-poly-textSecondary text-xs font-medium transition-all duration-200 hover:underline"
                >
                  Privacy
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
