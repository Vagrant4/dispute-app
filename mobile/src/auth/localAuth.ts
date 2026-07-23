export type LocalAccount = {
  id?: string;
  email: string;
  name: string;
  phone: string;
  emailVerified?: boolean;
};

export type AuthResult =
  | { ok: true; account: LocalAccount; message: string }
  | { ok: false; message: string };

export type LocalAccountStorage = {
  loadAccounts: () => Promise<LocalAccount[]>;
  saveAccounts: (accounts: LocalAccount[]) => Promise<void>;
};
