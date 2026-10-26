const FRIENDLY: Record<string, string> = {
  OverDailyLimit: "That is more than you can send today with your Daily key.",
  BadSignature: "The Daily key signature was not accepted. Unlock again and retry.",
  BadVaultKey: "The Vault Key did not match. Check your 24 words.",
  Expired: "The request expired. Please try again.",
  TransferFailed: "MUSD transfer failed. Check the balance.",
  AlreadyExists: "A Qeep account already exists for this Vault Key.",
  OnlySelf: "This setting can only be changed with your Vault Key.",
  ZeroValue: "Some details are missing.",
};

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  for (const [name, text] of Object.entries(FRIENDLY)) {
    if (message.includes(name)) return text;
  }
  if (/insufficient funds/i.test(message)) return "The Qeep relayer is out of test BTC for gas. Try again later.";
  return message.length > 160 ? `${message.slice(0, 160)}…` : message;
}
