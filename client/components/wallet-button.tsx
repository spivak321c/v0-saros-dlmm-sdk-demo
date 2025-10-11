import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  return (
    <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !text-primary-foreground !rounded-full !h-10 !w-10 !min-w-10 !p-0 !flex !items-center !justify-center !text-sm !font-semibold !transition-all !shadow-md hover:!shadow-lg !border-2 !border-primary-border" />
  );
}
