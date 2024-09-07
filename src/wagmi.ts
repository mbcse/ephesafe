"use client";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  argentWallet,
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import type { Transport, Chain } from "viem";
import { createConfig, http } from "wagmi";

const rootstockChain: Chain = {
  id: 31,
  name: 'Rootstock Testnet',
  nativeCurrency: {
    name: 'TRBTC',
    symbol: 'TRBTC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://public-node.testnet.rsk.co'],
    },
  },
  blockExplorers: {
    default: { name: 'RootStock Explorer', url: 'https://explorer.testnet.rootstock.io/' },
  },
  testnet: true,
};


const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!walletConnectProjectId) {
  throw new Error(
    "WalletConnect project ID is not defined. Please check your environment variables.",
  );
}

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [
        metaMaskWallet,
        rainbowWallet,
        // walletConnectWallet,
        ledgerWallet,
        rabbyWallet,
        coinbaseWallet,
        argentWallet,
        safeWallet,
      ],
    },
  ],
  { appName: "EpheSafe", projectId: walletConnectProjectId },
);

// Fix missing icons

const transports: Record<number, Transport> = {
  [rootstockChain.id]: http(),
};

export const wagmiConfig = createConfig({
  chains: [rootstockChain],
  connectors,
  transports,
  ssr: true,
});
