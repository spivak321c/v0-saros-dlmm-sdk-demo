import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Wallet, Copy, LogOut, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function WalletButton() {
  const { connected, publicKey, disconnect, select, wallets } = useWallet();
  const [showModal, setShowModal] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const handleConnect = () => {
    setShowModal(true);
  };

  const handleCopy = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const displayText = connected 
    ? `${publicKey?.toBase58().slice(0, 4)}...${publicKey?.toBase58().slice(-4)}`
    : 'Connect Wallet';

  if (!connected) {
    return (
      <>
        <Button
          variant="ghost"
          onClick={handleConnect}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-base font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <Wallet className="w-5 h-5" />
          <span>Connect Wallet</span>
        </Button>
        {showModal && (
          <div className="wallet-adapter-modal wallet-adapter-modal-fade-in" onClick={() => setShowModal(false)}>
            <div className="wallet-adapter-modal-container">
              <div className="wallet-adapter-modal-wrapper" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setShowModal(false)}
                  className="wallet-adapter-modal-button-close"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M14 1.41L12.59 0L7 5.59L1.41 0L0 1.41L5.59 7L0 12.59L1.41 14L7 8.41L12.59 14L14 12.59L8.41 7L14 1.41Z" />
                  </svg>
                </button>
                <h1 className="wallet-adapter-modal-title">Connect a wallet</h1>
                <ul className="wallet-adapter-modal-list">
                  {wallets.map((wallet) => (
                    <li key={wallet.adapter.name}>
                      <button
                        className="wallet-adapter-button"
                        onClick={() => {
                          select(wallet.adapter.name);
                          setShowModal(false);
                        }}
                      >
                        <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="wallet-adapter-button-start-icon" />
                        {wallet.adapter.name}
                        {wallet.readyState === 'Installed' && <span>Detected</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-base font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <Wallet className="w-5 h-5" />
          <span>{displayText}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 glass">
        <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          <span>{copied ? 'Copied!' : 'Copy Address'}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDisconnect} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
