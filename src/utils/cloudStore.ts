import { Transaction } from '@/types/finance';
import fs from 'fs';

const CLOUD_OBJECT_URL =
  'https://api.restful-api.dev/objects/ff808181a09d98f701a18d30599f63d8';
const TMP_FILE_PATH = '/tmp/fincontrol-cloud-state.json';

export interface CloudState {
  transactions: Transaction[];
  deletedIds: string[];
  appsScriptUrl: string;
  updatedAt: string;
}

const defaultState: CloudState = {
  transactions: [],
  deletedIds: [],
  appsScriptUrl: process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || '',
  updatedAt: new Date().toISOString(),
};

function readTmpFallback(): CloudState {
  try {
    if (fs.existsSync(TMP_FILE_PATH)) {
      const raw = fs.readFileSync(TMP_FILE_PATH, 'utf-8');
      return { ...defaultState, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return defaultState;
}

function writeTmpFallback(state: CloudState) {
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
      const state: CloudState = {
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
        appsScriptUrl: String(
          data.appsScriptUrl || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || ''
        ),
        updatedAt: String(data.updatedAt || new Date().toISOString()),
      };
      writeTmpFallback(state);
      return state;
    }
  } catch {
    // fallback to /tmp
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
    // fallback already saved in /tmp
  }

  return nextState;
}
