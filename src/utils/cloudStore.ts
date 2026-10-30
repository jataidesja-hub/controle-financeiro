import { BankAccount, Transaction } from '@/types/finance';
import { INITIAL_BANKS, INITIAL_TRANSACTIONS } from '@/data/initialData';
import fs from 'fs';

const TMP_FILE_PATH = '/tmp/fincontrol-cloud-state-v3.json';

export interface CloudState {
  transactions: Transaction[];
  banks: BankAccount[];
  deletedIds: string[];
  appsScriptUrl: string;
  updatedAt: string;
}

const defaultState: CloudState = {
  transactions: INITIAL_TRANSACTIONS,
  banks: INITIAL_BANKS,
  deletedIds: [],
  appsScriptUrl: process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '',
  updatedAt: new Date().toISOString(),
};

let memoryCache: CloudState | null = null;

export async function getCloudState(): Promise<CloudState> {
  if (memoryCache) return memoryCache;
  try {
    if (fs.existsSync(TMP_FILE_PATH)) {
      const raw = fs.readFileSync(TMP_FILE_PATH, 'utf-8');
      const parsed = { ...defaultState, ...JSON.parse(raw) };
      memoryCache = parsed;
      return parsed;
    }
  } catch {
    // ignore
  }
  return defaultState;
}

export async function saveCloudState(state: CloudState): Promise<CloudState> {
  const nextState: CloudState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  memoryCache = nextState;
  try {
    fs.writeFileSync(TMP_FILE_PATH, JSON.stringify(nextState), 'utf-8');
  } catch {
    // ignore
  }
  return nextState;
}
