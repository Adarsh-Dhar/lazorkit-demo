// lib/db.ts
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_PATH, 'subscriptions.json');

// Ensure data directory exists
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

export interface Subscription {
  id: string;
  userAddress: string;
  userUsdcAccount: string;
  sessionKeySecret: number[];
  monthsPrepaid: number;
  monthlyRate: number;
  approvedAmount: number;
  createdAt: number;
  nextChargeDate: number;
  status: 'active' | 'cancelled' | 'expired';
  chargeHistory: Array<{ date: number; amount: number; signature?: string; status: string }>;
}

export const db = {
  getAll: (): Subscription[] => {
    if (!fs.existsSync(DB_FILE)) return [];
    try {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (e) { return []; }
  },

  get: (id: string): Subscription | undefined => {
    const all = db.getAll();
    return all.find((s) => s.id === id);
  },

  create: (sub: Subscription) => {
    const all = db.getAll();
    all.push(sub);
    fs.writeFileSync(DB_FILE, JSON.stringify(all, null, 2));
  },

  update: (id: string, updates: Partial<Subscription>) => {
    const all = db.getAll();
    const index = all.findIndex((s) => s.id === id);
    if (index === -1) return null;
    
    all[index] = { ...all[index], ...updates };
    fs.writeFileSync(DB_FILE, JSON.stringify(all, null, 2));
    return all[index];
  }
};