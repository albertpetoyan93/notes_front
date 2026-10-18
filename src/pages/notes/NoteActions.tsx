import type { Note } from "../../store/noteStore";

export const isNoteOwner = (note: Note) => note.isOwner === true || note.permission === "owner";

export const canEditNote = (note: Note) => isNoteOwner(note) || note.permission === "edit";
