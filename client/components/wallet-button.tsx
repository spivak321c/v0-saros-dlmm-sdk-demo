import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  return (
    <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !text-primary-foreground !rounded-lg !h-10 !px-4 !text-sm !font-medium !transition-colors" />
  );
}
