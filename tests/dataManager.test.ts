import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { DataManager } from '../src/dataManager';
import { makeMockContext } from './helpers/mockContext';

const FIXTURE_1 = path.resolve(__dirname, 'fixtures/valid-import.json');
const FIXTURE_2 = path.resolve(__dirname, 'fixtures/valid-import-2.json');

function makeDm(extensionPath = '/nonexistent') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new DataManager(makeMockContext(extensionPath) as any);
}

async function dmWithFixture(fixturePath: string) {
  const dm = makeDm();
  await dm.initialize();
  await dm.importUserData(fixturePath);
  return dm;
}

// Write a temp JSON fixture with N Z-tables so we can test the slice regression
function writeLargeFixture(tableCount: number): string {
  const tables: Record<string, object> = {};
  for (let i = 0; i < tableCount; i++) {
    const name = `ZTABLE${String(i).padStart(5, '0')}`;
    tables[name] = { description: `Table ${i}`, fields: { [`FIELD${i}`]: { description: `Field ${i}` } } };
  }
  const content = JSON.stringify({ exported_at: '2026-01-01', tables });
  const tmpFile = path.join(os.tmpdir(), `sap-test-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, content);
  return tmpFile;
}

// ─── Merge logic ─────────────────────────────────────────────────────────────

describe('DataManager – merge logic', () => {
  it('user table not in bundled data is added', async () => {
    const dm = await dmWithFixture(FIXTURE_1);
    expect(dm.lookup('ZTABLE1')).not.toBeNull();
    expect(dm.lookup('ZTABLE3')).not.toBeNull();
  });

  it('user field overrides bundled field for same table', async () => {
    const dm = await dmWithFixture(FIXTURE_2);
    // ZTABLE1 from fixture-2 has "Client Updated" for MANDT
    const result = dm.lookup('ZTABLE1', 'MANDT');
    expect(result?.fieldInfo?.description).toBe('Client Updated');
  });

  it('second import wins over first on field conflict', async () => {
    const dm = makeDm();
    await dm.initialize();
    await dm.importUserData(FIXTURE_1);   // ZTABLE1/MANDT = "Client"
    await dm.importUserData(FIXTURE_2);   // ZTABLE1/MANDT = "Client Updated"
    const result = dm.lookup('ZTABLE1', 'MANDT');
    expect(result?.fieldInfo?.description).toBe('Client Updated');
  });

  it('second import adds new fields to existing table', async () => {
    const dm = makeDm();
    await dm.initialize();
    await dm.importUserData(FIXTURE_1);
    await dm.importUserData(FIXTURE_2);
    const result = dm.lookup('ZTABLE1', 'ZNEWFIELD');
    expect(result?.fieldInfo?.description).toBe('New Field from Second Import');
  });
});

// ─── Import validation ────────────────────────────────────────────────────────

describe('DataManager – import validation', () => {
  it('rejects file with no "tables" key', async () => {
    const tmpFile = path.join(os.tmpdir(), `sap-bad-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ data: {} }));
    const dm = makeDm();
    await dm.initialize();
    await expect(dm.importUserData(tmpFile)).rejects.toThrow('"tables" must be an object');
    fs.unlinkSync(tmpFile);
  });

  it('rejects table missing "fields" object', async () => {
    const tmpFile = path.join(os.tmpdir(), `sap-bad2-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify({ tables: { ZTABLE: { description: 'x' } } }));
    const dm = makeDm();
    await dm.initialize();
    await expect(dm.importUserData(tmpFile)).rejects.toThrow('missing a "fields" object');
    fs.unlinkSync(tmpFile);
  });

  it('accepts valid file and returns correct counts', async () => {
    const dm = makeDm();
    await dm.initialize();
    const { tableCount, fieldCount } = await dm.importUserData(FIXTURE_1);
    expect(tableCount).toBe(3);
    expect(fieldCount).toBe(5); // 2+2+1
  });

  it('multiple imports accumulate instead of overwrite', async () => {
    const dm = makeDm();
    await dm.initialize();
    await dm.importUserData(FIXTURE_1); // 3 tables
    await dm.importUserData(FIXTURE_2); // adds ZTABLE4, ZTABLE5 (ZTABLE1 overlap)
    expect(dm.getImportEntries()).toHaveLength(2);
    // ZTABLE1-5 should all be present
    for (const t of ['ZTABLE1','ZTABLE2','ZTABLE3','ZTABLE4','ZTABLE5']) {
      expect(dm.lookup(t), `expected ${t} to be found`).not.toBeNull();
    }
  });
});

// ─── Lookup & search ─────────────────────────────────────────────────────────

describe('DataManager – lookup and search', () => {
  it('returns null for unknown table', async () => {
    const dm = makeDm();
    await dm.initialize();
    expect(dm.lookup('NONEXISTENT_XYZ')).toBeNull();
  });

  it('returns tableInfo for known table (case-insensitive)', async () => {
    const dm = await dmWithFixture(FIXTURE_1);
    const result = dm.lookup('ztable1');
    expect(result?.tableName).toBe('ZTABLE1');
    expect(result?.tableInfo.description).toBe('Custom Table 1');
  });

  it('returns fieldInfo for known field', async () => {
    const dm = await dmWithFixture(FIXTURE_1);
    const result = dm.lookup('ZTABLE1', 'ZFIELD1');
    expect(result?.fieldInfo?.description).toBe('Custom Field 1');
  });

  it('search finds table by name', async () => {
    const dm = await dmWithFixture(FIXTURE_1);
    const results = dm.search('ZTABLE2');
    expect(results.some(r => r.tableName === 'ZTABLE2')).toBe(true);
  });
});

// ─── Slice regression: all tables visible after import ───────────────────────

describe('DataManager – all tables visible after import (regression)', () => {
  it('getAllTableNames returns all tables, not just 200', async () => {
    const tmpFile = writeLargeFixture(250);
    try {
      const dm = makeDm();
      await dm.initialize();
      await dm.importUserData(tmpFile);
      const names = dm.getAllTableNames();
      // All 250 Z-tables must be present (bundled = 0 in test, so exact count)
      expect(names.length).toBe(250);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it('deleteImportEntry removes only that file tables', async () => {
    const dm = makeDm();
    await dm.initialize();
    await dm.importUserData(FIXTURE_1);
    await dm.importUserData(FIXTURE_2);
    const entries = dm.getImportEntries();
    // Delete fixture-1 (ZTABLE1-3)
    const id1 = entries.find(e => e.filename === 'valid-import.json')!.id;
    await dm.deleteImportEntry(id1);
    // ZTABLE2 and ZTABLE3 were only in fixture-1 → gone
    expect(dm.lookup('ZTABLE2')).toBeNull();
    expect(dm.lookup('ZTABLE3')).toBeNull();
    // ZTABLE4 and ZTABLE5 were only in fixture-2 → still present
    expect(dm.lookup('ZTABLE4')).not.toBeNull();
    expect(dm.lookup('ZTABLE5')).not.toBeNull();
    // ZTABLE1 is in fixture-2 too → still present
    expect(dm.lookup('ZTABLE1')).not.toBeNull();
  });

  it('clearUserData removes all imported tables', async () => {
    const dm = makeDm();
    await dm.initialize();
    await dm.importUserData(FIXTURE_1);
    await dm.clearUserData();
    expect(dm.getImportEntries()).toHaveLength(0);
    for (const t of ['ZTABLE1','ZTABLE2','ZTABLE3']) {
      expect(dm.lookup(t)).toBeNull();
    }
  });
});
