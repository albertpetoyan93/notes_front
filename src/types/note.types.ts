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
export type NoteCategory = "note" | "password" | "login" | "command" | "other";

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
    { label: "Platform/Website", value: "" },
    { label: "Username/Email", value: "" },
    { label: "Password", value: "" },
    { label: "URL", value: "" },
  ],
  login: [
    { label: "Service", value: "" },
    { label: "Username", value: "" },
    { label: "Email", value: "" },
    { label: "Password", value: "" },
    { label: "2FA/Security", value: "" },
  ],
  command: [
    { label: "Server/Host", value: "" },
    { label: "IP Address", value: "" },
    { label: "Port", value: "" },
    { label: "Username", value: "" },
    { label: "Command", value: "" },
  ],
  other: [],
};
