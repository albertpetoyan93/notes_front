// Custom field structure for notes
export interface CustomField {
  label: string;
  value: string;
}

// Content structure for notes with custom fields
export interface NoteContent {
  mainContent: string;
  customFields: CustomField[];
}

// Note categories
export type NoteCategory =
  | "note"
  | "password"
  | "command"
  | "ssh"
  | "db"
  | "address"
  | "card"
  | "other";

// Full note interface
export interface Note {
  id: number;
  title: string;
  content: string; // JSON string containing NoteContent
  category: NoteCategory;
  tags?: string[];
  isFavorite: boolean;
  isEncrypted: boolean;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

// Helper to parse note content
export function parseNoteContent(content: string): NoteContent {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && "mainContent" in parsed) {
      return parsed as NoteContent;
    }
    // Fallback for plain text notes
    return {
      mainContent: content,
      customFields: [],
    };
  } catch {
    // Fallback for plain text notes
    return {
      mainContent: content,
      customFields: [],
    };
  }
}

// Helper to stringify note content
export function stringifyNoteContent(noteContent: NoteContent): string {
  return JSON.stringify(noteContent);
}

// Predefined field templates for each category
export const CATEGORY_FIELD_TEMPLATES: Record<NoteCategory, CustomField[]> = {
  note: [],
  password: [
    { label: "Platform", value: "" },
    { label: "Username", value: "" },
    { label: "Email", value: "" },
    { label: "Password", value: "" },
    { label: "Key/Pass", value: "" },
    { label: "URL", value: "" },
    { label: "2FA", value: "" },
  ],
  command: [
    { label: "Server/Host", value: "" },
    { label: "IP Address", value: "" },
    { label: "Port", value: "" },
    { label: "Username", value: "" },
    { label: "Command", value: "" },
  ],
  ssh: [
    { label: "Host", value: "" },
    { label: "Port", value: "22" },
    { label: "Username", value: "" },
    { label: "Password", value: "" },
    { label: "SSH Key Path", value: "" },
    { label: "Connection String", value: "" },
  ],
  db: [
    { label: "DB_HOST", value: "localhost" },
    { label: "DB_PORT", value: "5432" },
    { label: "DB_USER", value: "" },
    { label: "DB_NAME", value: "" },
    { label: "DB_PASSWORD", value: "" },
  ],
  address: [
    { label: "Full name", value: "" },
    { label: "Organization", value: "" },
    { label: "Email", value: "" },
    { label: "Phone", value: "" },
    { label: "Address", value: "" },
    { label: "Address 2", value: "" },
    { label: "City", value: "" },
    { label: "State", value: "" },
    { label: "Postal code", value: "" },
    { label: "Country", value: "" },
  ],
  card: [
    { label: "Cardholder", value: "" },
    { label: "Brand", value: "" },
    { label: "Number", value: "" },
    { label: "Expires", value: "" },
    { label: "CVV", value: "" },
    { label: "PIN", value: "" },
  ],
  other: [],
};
