'use client';

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function ConnectWalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="rounded-lg bg-purple-600 hover:bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition shadow-[0_0_15px_-5px_rgba(124,58,237,0.5)]"
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="rounded-lg bg-rose-600/80 hover:bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition"
                  >
                    Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition"
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? "Chain icon"}
                        src={chain.iconUrl}
                        className="h-4 w-4"
                      />
                    )}
                    {chain.name}
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="rounded-lg bg-white/10 hover:bg-white/20 border border-white/5 px-4 py-2 text-sm font-semibold text-white transition"
                  >
                    {account.displayName}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
