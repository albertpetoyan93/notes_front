// Turns a password manager's CSV export into 2keevo logins, entirely in the browser.
// The plain-text file is never uploaded; only the finished items go to the import API,
// where logins are encrypted like any other.

import type { ImportedNote, Note } from "../store/noteStore";
import { categoryKey } from "./noteCategory";
import { noteFields } from "./noteFields";

export type ImportSource =
  | "google"
  | "firefox"
  | "safari"
  | "onepassword"
  | "bitwarden"
  | "lastpass"
  | "other";

export const IMPORT_SOURCES: {
  id: ImportSource;
  label: string;
  collection: string;
  steps: string[];
}[] = [
  {
    id: "google",
    label: "Google / Chrome",
    collection: "Imported from Google",
    steps: [
      "In Chrome, open chrome://password-manager/settings (or passwords.google.com, then Settings).",
      "Choose Export passwords, confirm it's you, and save the .csv file.",
    ],
  },
  {
    id: "firefox",
    label: "Firefox",
    collection: "Imported from Firefox",
    steps: [
      "Open about:logins in Firefox.",
      "Open the ⋯ menu, choose Export passwords, and save the .csv file.",
    ],
  },
  {
    id: "safari",
    label: "Safari / iCloud",
    collection: "Imported from Safari",
    steps: [
      "On a Mac, open the Passwords app (or Safari › Settings › Passwords).",
      "Choose File › Export All Passwords and save the .csv file.",
    ],
  },
  {
    id: "onepassword",
    label: "1Password",
    collection: "Imported from 1Password",
    steps: [
      "In the 1Password desktop app, choose File › Export and pick the account.",
      "Select CSV as the format and save the file.",
    ],
  },
  {
    id: "bitwarden",
    label: "Bitwarden",
    collection: "Imported from Bitwarden",
    steps: [
      "In the Bitwarden web vault, open Tools › Export vault.",
      "Choose the .csv format (not encrypted JSON) and save the file.",
    ],
  },
  {
    id: "lastpass",
    label: "LastPass",
    collection: "Imported from LastPass",
    steps: [
      "In LastPass, open Advanced Options › Export.",
      "Save the .csv file it downloads.",
    ],
  },
  {
    id: "other",
    label: "Other (CSV)",
    collection: "Imported passwords",
    steps: [
      "Export your passwords as a .csv file with a header row.",
      "Columns named like name, url, username, password and notes are recognised.",
    ],
  },
];

/* CSV ------------------------------------------------------------------------ */

// RFC 4180: quoted fields, doubled quotes, commas and line breaks inside quotes.
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim()));
};

/* Columns -------------------------------------------------------------------- */

// Header names each manager uses for the same thing, lower-cased.
const COLUMNS = {
  title: ["name", "title"],
  url: ["url", "login_uri", "website", "uri", "web site", "login url"],
  username: ["username", "login_username", "login", "user name", "user", "email"],
  password: ["password", "login_password"],
  notes: ["note", "notes", "extra", "comments"],
  totp: ["otpauth", "totp", "login_totp", "one-time password"],
  favorite: ["favorite", "fav"],
  type: ["type"],
};

type Column = keyof typeof COLUMNS;

export interface ImportItem {
  key: string;
  title: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  totp: string;
  favorite: boolean;
  isNote: boolean;
}

export interface ImportPlan {
  items: ImportItem[];
  duplicates: ImportItem[];
  skippedEmpty: number;
  total: number;
}

const hostOf = (url: string) => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^android:\/\//i.test(trimmed)) {
    // android://<hash>@com.example.app/ -> com.example.app
    return trimmed.replace(/^android:\/\/[^@]*@/i, "").replace(/\/$/, "");
  }
  try {
    const parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return trimmed;
  }
};

// Same site and same username counts as the same login.
const loginKey = (url: string, username: string) =>
  `${hostOf(url).toLowerCase()}|${username.trim().toLowerCase()}`;

const truthy = (value: string) => /^(1|true|yes|y)$/i.test(value.trim());

export const readExport = (text: string): { header: string[]; rows: string[][] } => {
  const [header = [], ...rows] = parseCsv(text);
  return { header: header.map((cell) => cell.trim().toLowerCase()), rows };
};

// Which column holds what, by header name. Null when there is no password column at all.
export const mapColumns = (header: string[]) => {
  const index = {} as Record<Column, number>;
  (Object.keys(COLUMNS) as Column[]).forEach((column) => {
    index[column] = header.findIndex((name) => COLUMNS[column].includes(name));
  });
  return index.password < 0 ? null : index;
};

export const planImport = (text: string, vault: Note[]): ImportPlan | null => {
  const { header, rows } = readExport(text);
  const index = mapColumns(header);
  if (!index) return null;

  const cell = (row: string[], column: Column) =>
    index[column] >= 0 ? String(row[index[column]] ?? "").trim() : "";

  const existing = new Set(
    vault
      .filter((note) => categoryKey(note.category) === "password")
      .map((note) => {
        const fields = noteFields(note);
        const find = (pattern: RegExp) =>
          fields.find((field) => pattern.test(field.label) && field.value.trim())?.value || "";
        return loginKey(find(/^(url|uri|website)$/i), find(/^(username|email|login)$/i));
      })
  );

  const seen = new Set<string>();
  const items: ImportItem[] = [];
  const duplicates: ImportItem[] = [];
  let skippedEmpty = 0;

  rows.forEach((row) => {
    const url = cell(row, "url");
    const username = cell(row, "username");
    const password = cell(row, "password");
    const notes = cell(row, "notes");
    const type = cell(row, "type").toLowerCase();
    // Bitwarden marks secure notes with type "note"; LastPass with the URL http://sn.
    const isNote = type === "note" || url === "http://sn";

    if (!isNote && !password) {
      skippedEmpty += 1;
      return;
    }
    if (isNote && !notes) {
      skippedEmpty += 1;
      return;
    }

    const title = cell(row, "title") || hostOf(url) || username || "Imported login";
    // With no site and no username, only the name and password tell two logins apart.
    const key = isNote
      ? `note|${title}|${notes}`
      : hostOf(url) || username
        ? loginKey(url, username)
        : `bare|${title.toLowerCase()}|${password}`;
    const item: ImportItem = {
      key,
      title,
      url: isNote ? "" : url,
      username,
      password,
      notes,
      totp: cell(row, "totp"),
      favorite: truthy(cell(row, "favorite")),
      isNote,
    };

    if (seen.has(item.key) || (!isNote && existing.has(item.key))) {
      duplicates.push(item);
      return;
    }
    seen.add(item.key);
    items.push(item);
  });

  return { items, duplicates, skippedEmpty, total: rows.length };
};

// The shape the import API expects. Logins use the same field names as a new login.
export const toNotePayload = (item: ImportItem, collection: string): ImportedNote => {
  const fields = item.isNote
    ? []
    : [
        { label: "Username", value: item.username },
        { label: "Password", value: item.password },
        { label: "URL", value: item.url },
        { label: "2FA", value: item.totp },
      ].filter((field) => field.value);

  return {
    title: item.title,
    category: item.isNote ? "note" : "password",
    content: { mainContent: item.notes, customFields: fields },
    tags: [],
    collections: collection ? [collection] : [],
    isFavorite: item.favorite,
  };
};
