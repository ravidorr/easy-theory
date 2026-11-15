export type BackupTable = {
  name: string;
  /** Columns that identify a row. Used for ordering and for idempotent restore. */
  key: readonly string[];
  /** The table has no primary key: restore inserts only rows whose identity is missing. */
  insertMissing?: boolean;
  /** Full ordering for paging when `key` can tie. Defaults to `key`. */
  pageOrder?: readonly string[];
  /** Public content that user rows reference by id. Backed up so the original ids survive a rebuild. */
  content?: boolean;
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
  // Content comes first: the seeds generate fresh UUIDs, so user rows can only be restored against the original ids.
  { name: "content_source_releases", key: ["id"], content: true },
  { name: "topics", key: ["id"], content: true },
  { name: "questions", key: ["id"], content: true },
  { name: "signs", key: ["id"], content: true },
  { name: "user_stats", key: ["user_id"] },
  { name: "user_medals", key: ["id"] },
  { name: "user_schedule", key: ["id"] },
  { name: "user_learner_plans", key: ["user_id"] },
  { name: "user_topic_progress", key: ["id"] },
  { name: "user_quiz_responses", key: ["id"] },
  {
    name: "quiz_answer_events",
    key: ["user_id", "question_id", "answered_at"],
    pageOrder: ["user_id", "question_id", "answered_at", "is_correct"],
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

/** Tables that exist in the schema but are deliberately not backed up. A test keeps this and BACKUP_TABLES complete. */
export const OMITTED_TABLES: Record<string, string> = {
  quiz_answer_submissions: "24 hour replay cache",
  quiz_submission_rate_limits: "abuse-control counters",
  schedule_notification_deliveries: "short-lived delivery lease",
  videos: "public content, rebuilt from seeds",
  resources: "public content, rebuilt from seeds",
  schema_migrations: "rebuilt by the migration runner",
  user_answer_confidence: "dropped by migration 033",
};

export type Row = Record<string, unknown>;

/** Columns that point at another backed-up file's `id`. Used to check that an export is internally consistent. */
export const REFERENCES: Record<string, string> = {
  user_id: USERS_FILE,
  topic_id: "topics",
  question_id: "questions",
  sign_id: "signs",
  attempt_id: "user_exam_attempts",
  source_release_id: "content_source_releases",
};
export const ARRAY_REFERENCES: Record<string, string> = { question_ids: "questions" };

export type BackupClient = {
  /** Returns one page of rows (every column), ordered by `key`, plus the exact table row count. */
  readPage(table: string, key: readonly string[], offset: number, limit: number): Promise<{ rows: Row[]; count: number }>;
  /** Returns one page of auth users (1-based pages) plus the total number of users. */
  listUsers(page: number, perPage: number): Promise<{ users: Row[]; total: number }>;
};

export type RestoreClient = BackupClient & {
  userExists(id: string): Promise<boolean>;
  createUser(user: Row): Promise<void>;
  upsertRows(table: BackupTable, rows: Row[]): Promise<void>;
  insertRows(table: BackupTable, rows: Row[]): Promise<void>;
};

export class BackupError extends Error {}
