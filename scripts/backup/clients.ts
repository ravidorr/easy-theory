import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { BackupError, USER_FIELDS, type BackupTable, type RestoreClient, type Row } from "./tables";

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

function identifier(name: string): string {
  if (!IDENTIFIER.test(name)) throw new BackupError("unsafe identifier");
  return `"${name}"`;
}

export function supabaseClient(
  url: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRoleKey: string | undefined = process.env.SUPABASE_SERVICE_ROLE_KEY
): RestoreClient {
  if (!url || !serviceRoleKey) {
    throw new BackupError("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Error messages from the API can quote row values, so only the code and table are reported.
  const fail = (what: string, error: { code?: string }): never => {
    throw new BackupError(`${what} failed (${error.code ?? "no code"})`);
  };

  return {
    async readPage(table, offset, limit) {
      const { data, error, count } = await supabase
        .from(table)
        .select("*", { count: "exact" })
        .range(offset, offset + limit - 1);
      if (error) return fail(`read of ${table}`, error);
      return { rows: (data ?? []) as Row[], count: count ?? 0 };
    },
    async listUsers(page, perPage) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) return fail("read of auth users", { code: String(error.status ?? "") });
      return data.users.map((user) => pickUserFields(user as unknown as Row));
    },
    async userExists(id) {
      const { data, error } = await supabase.auth.admin.getUserById(id);
      if (error && error.status !== 404) return fail("lookup of an auth user", { code: String(error.status ?? "") });
      return Boolean(data?.user);
    },
    async createUser(user) {
      const { error } = await supabase.auth.admin.createUser({
        id: user.id as string,
        email: (user.email as string | null) ?? undefined,
        phone: (user.phone as string | null) || undefined,
        email_confirm: Boolean(user.email_confirmed_at),
        user_metadata: (user.user_metadata as object) ?? {},
        app_metadata: (user.app_metadata as object) ?? {},
      });
      if (error) fail("creation of an auth user", { code: String(error.status ?? "") });
    },
    async upsertRows(table, rows) {
      const { error } = await supabase.from(table.name).upsert(rows, { onConflict: table.key.join(",") });
      if (error) fail(`restore of ${table.name}`, error);
    },
    async insertRows(table, rows) {
      const { error } = await supabase.from(table.name).insert(rows);
      if (error) fail(`restore of ${table.name}`, error);
    },
  };
}

export function pickUserFields(user: Row): Row {
  return Object.fromEntries(USER_FIELDS.map((field) => [field, user[field] ?? null]));
}

/** Direct PostgreSQL client. Used for the restore rehearsal against a local database and for restoring into a fresh project. */
export function postgresClient(databaseUrl: string): RestoreClient & { end(): Promise<void> } {
  const sql = postgres(databaseUrl, { max: 1, prepare: false, onnotice: () => {} });

  return {
    end: () => sql.end({ timeout: 5 }),
    async readPage(table, offset, limit) {
      const name = identifier(table);
      const [{ count }] = await sql.unsafe(`SELECT count(*)::int AS count FROM public.${name}`);
      const rows = await sql.unsafe(
        `SELECT to_jsonb(t) AS row FROM public.${name} t ORDER BY to_jsonb(t)::text OFFSET ${offset} LIMIT ${limit}`
      );
      return { rows: rows.map((entry) => entry.row as Row), count };
    },
    async listUsers(page, perPage) {
      const rows = await sql`
        SELECT jsonb_build_object(
          'id', id, 'email', email, 'phone', phone, 'created_at', created_at,
          'last_sign_in_at', last_sign_in_at, 'email_confirmed_at', email_confirmed_at,
          'user_metadata', coalesce(raw_user_meta_data, '{}'::jsonb),
          'app_metadata', coalesce(raw_app_meta_data, '{}'::jsonb)
        ) AS row
        FROM auth.users ORDER BY id OFFSET ${(page - 1) * perPage} LIMIT ${perPage}`;
      return rows.map((entry) => entry.row as Row);
    },
    async userExists(id) {
      const rows = await sql`SELECT 1 FROM auth.users WHERE id = ${id}`;
      return rows.length > 0;
    },
    async createUser(user) {
      await sql`
        INSERT INTO auth.users (id, email, phone, created_at, last_sign_in_at, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
        VALUES (${user.id as string}, ${(user.email as string | null) ?? null}, ${(user.phone as string | null) ?? null},
          ${(user.created_at as string | null) ?? null}::text::timestamptz, ${(user.last_sign_in_at as string | null) ?? null}::text::timestamptz,
          ${(user.email_confirmed_at as string | null) ?? null}::text::timestamptz,
          ${sql.json((user.user_metadata ?? {}) as never)}, ${sql.json((user.app_metadata ?? {}) as never)})
        ON CONFLICT (id) DO NOTHING`;
    },
    async upsertRows(table: BackupTable, rows) {
      const name = identifier(table.name);
      const key = table.key.map(identifier).join(", ");
      const columns = Object.keys(rows[0]).map(identifier);
      const updates = columns.filter((column) => !table.key.map(identifier).includes(column));
      const action = updates.length
        ? `DO UPDATE SET ${updates.map((column) => `${column} = EXCLUDED.${column}`).join(", ")}`
        : "DO NOTHING";
      await sql.unsafe(
        `INSERT INTO public.${name} SELECT * FROM jsonb_populate_recordset(null::public.${name}, $1::text::jsonb) ON CONFLICT (${key}) ${action}`,
        [JSON.stringify(rows)]
      );
    },
    async insertRows(table, rows) {
      const name = identifier(table.name);
      await sql.unsafe(
        `INSERT INTO public.${name} SELECT * FROM jsonb_populate_recordset(null::public.${name}, $1::text::jsonb)`,
        [JSON.stringify(rows)]
      );
    },
  };
}
