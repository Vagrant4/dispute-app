export type LocalAccount = {
  id?: string;
  email: string;
  name: string;
  phone: string;
  password: string;
  emailVerified?: boolean;
};

export type AuthResult =
  | { ok: true; account: LocalAccount; message: string }
  | { ok: false; message: string };

const STORAGE_KEY = "dispute-local-accounts";
const accounts = new Map<string, LocalAccount>();
let loaded = false;

export type LocalAccountStorage = {
  loadAccounts: () => Promise<LocalAccount[]>;
  saveAccounts: (accounts: LocalAccount[]) => Promise<void>;
};

export async function createLocalAccount(input: {
  email: string;
  name: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}, storage?: LocalAccountStorage): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const phone = input.phone?.trim() ?? "";
  const password = input.password;

  if (!name) {
    return { ok: false, message: "Enter your full name." };
  }

  if (!isValidEmail(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (password.length < 4) {
    return { ok: false, message: "Use at least 4 characters for the password." };
  }

  if (password !== input.confirmPassword) {
    return { ok: false, message: "Passwords do not match." };
  }

  await loadStoredAccounts(storage);
  if (accounts.has(email)) {
    return { ok: false, message: "This email already has a local account." };
  }

  const account = { email, name, phone, password };
  accounts.set(email, account);
  await saveStoredAccounts(storage);
  return {
    ok: true,
    account,
    message: "Account created on this phone. You are logged in.",
  };
}

export async function loginLocalAccount(input: {
  email: string;
  password: string;
}, storage?: LocalAccountStorage): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!isValidEmail(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  if (password.length < 4) {
    return { ok: false, message: "Use at least 4 characters for the password." };
  }

  await loadStoredAccounts(storage);

  const account = accounts.get(email);
  if (!account || account.password !== password) {
    return {
      ok: false,
      message: "Email or password is not correct. New users should tap Create account first.",
    };
  }

  return { ok: true, account, message: "Login successful." };
}

export async function hasLocalAccounts(storage?: LocalAccountStorage): Promise<boolean> {
  await loadStoredAccounts(storage);
  return accounts.size > 0;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getWebStorage(): { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } | null {
  const storage = (globalThis as unknown as {
    localStorage?: {
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
    };
  }).localStorage;

  return storage ?? null;
}

async function loadStoredAccounts(storage?: LocalAccountStorage): Promise<void> {
  if (loaded) {
    return;
  }

  try {
    const parsed = storage
      ? await storage.loadAccounts()
      : JSON.parse(getWebStorage()?.getItem(STORAGE_KEY) ?? "[]") as LocalAccount[];
    for (const account of parsed) {
      if (account.email && account.name && account.password) {
        accounts.set(normalizeEmail(account.email), {
          id: account.id,
          email: normalizeEmail(account.email),
          name: account.name,
          phone: account.phone ?? "",
          password: account.password,
          emailVerified: account.emailVerified ?? false,
        });
      }
    }
    loaded = true;
  } catch {
    accounts.clear();
    loaded = true;
  }
}

async function saveStoredAccounts(storage?: LocalAccountStorage): Promise<void> {
  const accountList = [...accounts.values()];
  if (storage) {
    await storage.saveAccounts(accountList);
    return;
  }

  getWebStorage()?.setItem(STORAGE_KEY, JSON.stringify(accountList));
}
