#!/usr/bin/env node
/**
 * Reads your udrop.com account and writes files.json for the static site.
 * Runs in GitHub Actions only — the API keys never reach the browser.
 *
 * Env:
 *   UDROP_KEY1  required, 64-char API key 1
 *   UDROP_KEY2  required, 64-char API key 2
 *   ROOT_FOLDER_ID  optional, only publish this folder (and its children)
 *
 * Unlike UploadG, udrop hands back a ready-to-use public download URL
 * (url_file) straight from /folder/listing — no separate share-link step.
 */

import { readFile, writeFile } from 'node:fs/promises';

const API = 'https://www.udrop.com/api/v2';
const KEY1 = process.env.UDROP_KEY1;
const KEY2 = process.env.UDROP_KEY2;
const ROOT_FOLDER_ID = process.env.ROOT_FOLDER_ID || null;
const OUT = 'files.json';

if (!KEY1 || !KEY2) {
  console.error('UDROP_KEY1 and/or UDROP_KEY2 are not set.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, params = {}, attempt = 0) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  if (res.status === 429 && attempt < 3) {
    const wait = 5 * (attempt + 1);
    console.warn(`Rate limited on ${path}; waiting ${wait}s`);
    await sleep(wait * 1000);
    return api(path, params, attempt + 1);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json._status === 'error') {
    const msg = json?.response || `HTTP ${res.status}`;
    throw new Error(`${path} -> ${msg}`);
  }
  return json;
}

async function authorize() {
  const { data } = await api('/authorize', { key1: KEY1, key2: KEY2 });
  return data; // { access_token, account_id }
}

async function listFolder(auth, folderId) {
  const { data } = await api('/folder/listing', {
    access_token: auth.access_token,
    account_id: auth.account_id,
    ...(folderId ? { parent_folder_id: folderId } : {}),
  });
  return data; // { folders: [...], files: [...] }
}

/** Walk the whole tree, depth-first, recording each entry's path. */
async function walk(auth, folderId, trail, out) {
  const { folders = [], files = [] } = await listFolder(auth, folderId);

  for (const folder of folders) {
    out.push({
      name: folder.folderName,
      folder: true,
      path: trail,
      size: null,
      extension: null,
      modified: folder.date_updated || folder.date_added || null,
      description: null,
      url: null,
    });
    await walk(auth, folder.id, [...trail, folder.folderName], out);
  }

  for (const file of files) {
    out.push({
      name: file.filename,
      folder: false,
      path: trail,
      size: Number(file.fileSize) || 0,
      extension: file.extension || null,
      modified: null, // /folder/listing doesn't return per-file dates
      description: file.keywords || null,
      url: file.url_file || null,
    });
  }
}

const auth = await authorize();
const files = [];
await walk(auth, ROOT_FOLDER_ID, [], files);

files.sort((a, b) => {
  if (a.folder !== b.folder) return a.folder ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
});

const next = { files };
const prevRaw = await readFile(OUT, 'utf8').catch(() => '');

let prevFiles = '';
try {
  prevFiles = JSON.stringify(JSON.parse(prevRaw).files);
} catch {
  prevFiles = '';
}

if (prevFiles === JSON.stringify(next.files)) {
  console.log(`No changes (${files.length} entries).`);
  process.exit(0);
}

next.generated = new Date().toISOString();
await writeFile(OUT, JSON.stringify(next, null, 2) + '\n');
console.log(`Wrote ${files.length} entries to ${OUT}.`);
