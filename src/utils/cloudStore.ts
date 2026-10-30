import { BankAccount, Transaction } from '@/types/finance';
import { INITIAL_BANKS, INITIAL_TRANSACTIONS } from '@/data/initialData';
import fs from 'fs';

const CLOUD_OBJECT_URL =
  'https://api.restful-api.dev/objects/ff808181a09d98f701a18d30599f63d8';
const TMP_FILE_PATH = '/tmp/fincontrol-cloud-state.json';

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

function readTmpFallback(): CloudState {
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

function writeTmpFallback(state: CloudState) {
  memoryCache = state;
  try {
    fs.writeFileSync(TMP_FILE_PATH, JSON.stringify(state), 'utf-8');
  } catch {
    // ignore
  }
}

export async function getCloudState(): Promise<CloudState> {
  try {
    const res = await fetch(CLOUD_OBJECT_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (res.ok) {
      const json = await res.json();
      const data = json?.data || {};
      const remoteTx: Transaction[] = Array.isArray(data.transactions)
        ? data.transactions
        : [];
      const remoteBanks: BankAccount[] = Array.isArray(data.banks)
        ? data.banks
        : [];
      const remoteDeleted: string[] = Array.isArray(data.deletedIds)
        ? data.deletedIds
        : [];

      const local = readTmpFallback();
      const deletedSet = new Set([...remoteDeleted, ...local.deletedIds]);
      const mergedMap = new Map<string, Transaction>();

      for (const t of INITIAL_TRANSACTIONS) {
        if (t && t.id && !deletedSet.has(t.id)) {
          mergedMap.set(t.id, t);
        }
      }
      for (const t of local.transactions) {
        if (t && t.id && !deletedSet.has(t.id)) {
          mergedMap.set(t.id, t);
        }
      }
      for (const t of remoteTx) {
        if (t && t.id && !deletedSet.has(t.id)) {
          mergedMap.set(t.id, t);
        }
      }

      const banksToUse =
        remoteBanks.length > 0
          ? remoteBanks
          : local.banks && local.banks.length > 0
          ? local.banks
          : INITIAL_BANKS;

      const state: CloudState = {
        transactions: Array.from(mergedMap.values()).sort((a, b) =>
          b.data.localeCompare(a.data)
        ),
        banks: banksToUse,
        deletedIds: Array.from(deletedSet),
        appsScriptUrl: String(
          data.appsScriptUrl ||
            local.appsScriptUrl ||
            process.env.NEXT_PUBLIC_APPS_SCRIPT_URL ||
            ''
        ),
        updatedAt: String(data.updatedAt || new Date().toISOString()),
      };
      writeTmpFallback(state);
      return state;
    }
  } catch {
    // fallback to /tmp + memory
  }
  return readTmpFallback();
}

export async function saveCloudState(state: CloudState): Promise<CloudState> {
  const nextState: CloudState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  writeTmpFallback(nextState);

  try {
    await fetch(CLOUD_OBJECT_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        name: 'fincontrol-db',
        data: nextState,
      }),
      cache: 'no-store',
    });
  } catch {
    // fallback already saved in memory & /tmp
  }

  return nextState;
}
