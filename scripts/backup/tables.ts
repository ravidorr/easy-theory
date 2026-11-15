export type BackupTable = {
  name: string;
  /** Columns that identify a row. Used for ordering and for idempotent restore. */
  key: readonly string[];
  /** The table has no primary key: restore inserts only rows whose identity is missing. */
  insertMissing?: boolean;
};

export const USERS_FILE = "auth_users";
export const USER_FIELDS = [
  "app_metadata",
  "created_at",
  "email",
  "email_confirmed_at",
  "id",
  "last_sign_in_at",
  "phone",
  "user_metadata",
] as const;

/** Foreign-key order: auth users first, then tables that reference users, then tables that reference those. */
export const BACKUP_TABLES: readonly BackupTable[] = [
  { name: "user_stats", key: ["user_id"] },
  { name: "user_medals", key: ["id"] },
  { name: "user_schedule", key: ["id"] },
  { name: "user_learner_plans", key: ["user_id"] },
  { name: "user_topic_progress", key: ["id"] },
  { name: "user_quiz_responses", key: ["id"] },
  {
    name: "quiz_answer_events",
    key: ["user_id", "question_id", "answered_at"],
    insertMissing: true,
  },
  { name: "quiz_question_rewards", key: ["user_id", "question_id"] },
  { name: "user_exam_attempts", key: ["id"] },
  { name: "user_exam_sessions", key: ["id"] },
  { name: "user_diagnostic_attempts", key: ["id"] },
  { name: "user_question_bookmarks", key: ["user_id", "question_id"] },
  { name: "user_srs_cards", key: ["id"] },
  { name: "user_push_subscriptions", key: ["id"] },
  { name: "contact_messages", key: ["id"] },
  { name: "question_reports", key: ["id"] },
];

export type Row = Record<string, unknown>;

export type BackupClient = {
  /** Returns one page of rows (every column) plus the exact table row count. */
  readPage(table: string, offset: number, limit: number): Promise<{ rows: Row[]; count: number }>;
  /** Returns one page of auth users, 1-based page numbers. */
  listUsers(page: number, perPage: number): Promise<Row[]>;
};

export type RestoreClient = BackupClient & {
  userExists(id: string): Promise<boolean>;
  createUser(user: Row): Promise<void>;
  upsertRows(table: BackupTable, rows: Row[]): Promise<void>;
  insertRows(table: BackupTable, rows: Row[]): Promise<void>;
};

export class BackupError extends Error {}
