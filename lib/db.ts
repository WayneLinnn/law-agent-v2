import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  SEEDED_CLIENT,
  SEEDED_MATERIALS,
  SEEDED_MATTER,
  SEEDED_PARTIES,
} from "@/lib/seed";

const globalForDb = globalThis as unknown as { lawDb?: DatabaseSync };

export const dataDir = path.join(process.cwd(), "data");

function matterFilesDir(matterId: string) {
  return path.join(dataDir, "files", matterId);
}

export function materialFilePath(matterId: string, filename: string) {
  return path.join(matterFilesDir(matterId), path.basename(filename));
}

export function removeMatterFiles(matterId: string) {
  fs.rmSync(matterFilesDir(matterId), { recursive: true, force: true });
}

function ensureSeedFiles() {
  const dir = matterFilesDir(SEEDED_MATTER.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const material of SEEDED_MATERIALS) {
    const full = materialFilePath(SEEDED_MATTER.id, material.filename);
    if (!fs.existsSync(full)) {
      fs.writeFileSync(full, material.text, "utf8");
    }
  }
}

function seed(db: DatabaseSync) {
  const existing = db.prepare("SELECT COUNT(*) AS n FROM matters").get() as {
    n: number;
  };
  if (existing.n > 0) {
    ensureSeedFiles();
    return;
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO clients (id, name) VALUES (?, ?)").run(
      SEEDED_CLIENT.id,
      SEEDED_CLIENT.name,
    );
    db.prepare(
      `INSERT INTO matters (id, name, status, cause, created_at) VALUES (?, ?, ?, ?, ?)`,
    ).run(
      SEEDED_MATTER.id,
      SEEDED_MATTER.name,
      SEEDED_MATTER.status,
      SEEDED_MATTER.cause,
      SEEDED_MATTER.createdAt,
    );
    const insertParty = db.prepare(
      `INSERT INTO parties (id, matter_id, role, name, client_id) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const party of SEEDED_PARTIES) {
      insertParty.run(
        party.id,
        SEEDED_MATTER.id,
        party.role,
        party.name,
        party.clientId,
      );
    }
    const insertMaterial = db.prepare(
      `INSERT INTO materials (id, matter_id, filename, extracted_text, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const material of SEEDED_MATERIALS) {
      insertMaterial.run(
        material.id,
        SEEDED_MATTER.id,
        material.filename,
        material.text,
        material.createdAt,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    const after = db.prepare("SELECT COUNT(*) AS n FROM matters").get() as {
      n: number;
    };
    if (after.n === 0) throw error;
  }

  ensureSeedFiles();
}

function ensureDraftColumns(db: DatabaseSync) {
  const columns = db.prepare("PRAGMA table_info(matters)").all() as {
    name: string;
  }[];
  const names = new Set(columns.map((column) => column.name));
  if (!names.has("facts")) {
    db.exec("ALTER TABLE matters ADD COLUMN facts TEXT NOT NULL DEFAULT ''");
  }
  if (!names.has("mandate")) {
    db.exec(
      "ALTER TABLE matters ADD COLUMN mandate TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!names.has("claim_amount")) {
    db.exec("ALTER TABLE matters ADD COLUMN claim_amount REAL");
  }
  if (!names.has("limitation_start")) {
    db.exec("ALTER TABLE matters ADD COLUMN limitation_start TEXT");
  }
  if (!names.has("fee_receivable")) {
    db.exec("ALTER TABLE matters ADD COLUMN fee_receivable REAL");
  }
  if (!names.has("fee_received")) {
    db.exec("ALTER TABLE matters ADD COLUMN fee_received REAL");
  }
}

function columnNames(db: DatabaseSync, table: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return new Set(columns.map((column) => column.name));
}

function ensureCaseShape(db: DatabaseSync) {
  const matters = columnNames(db, "matters");
  if (!matters.has("case_number")) {
    db.exec(
      "ALTER TABLE matters ADD COLUMN case_number TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!matters.has("instance")) {
    db.exec("ALTER TABLE matters ADD COLUMN instance TEXT NOT NULL DEFAULT ''");
  }
  if (!matters.has("procedure")) {
    db.exec(
      "ALTER TABLE matters ADD COLUMN procedure TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!matters.has("parent_matter_id")) {
    db.exec("ALTER TABLE matters ADD COLUMN parent_matter_id TEXT");
  }
  if (!matters.has("category")) {
    db.exec("ALTER TABLE matters ADD COLUMN category TEXT NOT NULL DEFAULT ''");
  }
  if (!matters.has("engaged_on")) {
    db.exec(
      "ALTER TABLE matters ADD COLUMN engaged_on TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!matters.has("court_name")) {
    db.exec(
      "ALTER TABLE matters ADD COLUMN court_name TEXT NOT NULL DEFAULT ''",
    );
  }
  db.exec(`
    UPDATE matters
    SET court_name = (
      SELECT name FROM parties
      WHERE parties.matter_id = matters.id AND parties.role = 'court'
      LIMIT 1
    )
    WHERE court_name = ''
      AND EXISTS (
        SELECT 1 FROM parties
        WHERE parties.matter_id = matters.id AND parties.role = 'court'
      )
  `);

  const parties = columnNames(db, "parties");
  if (!parties.has("position")) {
    db.exec("ALTER TABLE parties ADD COLUMN position TEXT NOT NULL DEFAULT ''");
  }
  if (!parties.has("id_number")) {
    db.exec(
      "ALTER TABLE parties ADD COLUMN id_number TEXT NOT NULL DEFAULT ''",
    );
  }

  const materials = columnNames(db, "materials");
  if (!materials.has("kind")) {
    db.exec(
      "ALTER TABLE materials ADD COLUMN kind TEXT NOT NULL DEFAULT '往来文书'",
    );
  }
  if (!materials.has("proves")) {
    db.exec(
      "ALTER TABLE materials ADD COLUMN proves TEXT NOT NULL DEFAULT ''",
    );
  }
  if (!materials.has("submitted_by")) {
    db.exec("ALTER TABLE materials ADD COLUMN submitted_by TEXT");
  }

  const tasks = columnNames(db, "tasks");
  if (tasks.has("id")) {
    if (!tasks.has("due_time")) {
      db.exec("ALTER TABLE tasks ADD COLUMN due_time TEXT NOT NULL DEFAULT ''");
    }
    if (!tasks.has("place")) {
      db.exec("ALTER TABLE tasks ADD COLUMN place TEXT NOT NULL DEFAULT ''");
    }
    if (!tasks.has("repeat")) {
      db.exec("ALTER TABLE tasks ADD COLUMN repeat TEXT NOT NULL DEFAULT ''");
    }
    if (!tasks.has("repeat_until")) {
      db.exec(
        "ALTER TABLE tasks ADD COLUMN repeat_until TEXT NOT NULL DEFAULT ''",
      );
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS judges (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      division TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS court_officers (
      matter_id TEXT PRIMARY KEY REFERENCES matters(id),
      judge TEXT NOT NULL DEFAULT '',
      assistant TEXT NOT NULL DEFAULT '',
      clerk TEXT NOT NULL DEFAULT '',
      division TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT ''
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rulings (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id),
      material_id TEXT NOT NULL UNIQUE REFERENCES materials(id),
      kind TEXT NOT NULL CHECK (kind IN ('判决', '裁定', '调解书')),
      decided_on TEXT NOT NULL DEFAULT '',
      served_on TEXT NOT NULL DEFAULT '',
      effective_on TEXT NOT NULL DEFAULT '',
      result TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
  `);
}

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('草稿', '待立案', '办理中', '结案中', '已结案', '已归档', '已终止', '已删除')),
      cause TEXT NOT NULL,
      created_at TEXT NOT NULL,
      deleted_on TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS parties (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id),
      role TEXT NOT NULL CHECK (role IN ('client', 'ally', 'opposing', 'court')),
      name TEXT NOT NULL,
      client_id TEXT REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS materials (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id),
      filename TEXT NOT NULL,
      extracted_text TEXT NOT NULL,
      dossier_position TEXT,
      created_at TEXT NOT NULL
    );
  `);
  ensureDraftColumns(db);
  ensureCaseShape(db);
  ensureTaskTable(db);
  ensureElementTable(db);
  ensureFocusTable(db);
  ensureSourceTable(db);
  ensureDraftTable(db);
  ensureClosingTables(db);
  ensurePreservationTable(db);
  ensureMatterAskTable(db);
  ensurePartyRoles(db);
  ensureDeletedStatus(db);
  ensureContractReviewTable(db);
  restorePrematureClosing(db);
}

const taskTableSql = `
  CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    matter_id TEXT NOT NULL REFERENCES matters(id),
    kind TEXT NOT NULL CHECK (kind IN ('答辩', '举证', '开庭', '上诉', '保全', '管辖权异议', '鉴定', '公告期满', '再审', '执行申请', '其他')),
    custom_name TEXT NOT NULL DEFAULT '',
    due_on TEXT NOT NULL,
    due_time TEXT NOT NULL DEFAULT '',
    place TEXT NOT NULL DEFAULT '',
    repeat TEXT NOT NULL DEFAULT '',
    repeat_until TEXT NOT NULL DEFAULT '',
    end_on TEXT,
    start_on TEXT,
    variant TEXT NOT NULL DEFAULT '',
    basis_note TEXT NOT NULL DEFAULT '',
    note TEXT NOT NULL DEFAULT '',
    confirmed_at TEXT,
    created_at TEXT NOT NULL
  );
`;

function ensureTaskTable(db: DatabaseSync) {
  const table = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'tasks'",
    )
    .get();
  if (!table) {
    db.exec(taskTableSql);
    return;
  }
  const columns = db.prepare("PRAGMA table_info(tasks)").all() as {
    name: string;
  }[];
  const names = new Set(columns.map((column) => column.name));
  if (names.has("custom_name") && names.has("basis_note")) return;

  db.exec("PRAGMA foreign_keys = OFF");
  db.exec(taskTableSql.replace("CREATE TABLE tasks", "CREATE TABLE tasks_next"));
  db.exec(`
    INSERT INTO tasks_next (
      id, matter_id, kind, custom_name, due_on, end_on, start_on, variant,
      basis_note, note, confirmed_at, created_at
    )
    SELECT id, matter_id, kind, '', due_on, due_on, NULL, '', '', note, confirmed_at, created_at
    FROM tasks
  `);
  db.exec("DROP TABLE tasks");
  db.exec("ALTER TABLE tasks_next RENAME TO tasks");
  db.exec("PRAGMA foreign_keys = ON");
}

function openDatabase() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "law.sqlite"));
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA busy_timeout = 5000");
  migrate(db);
  seed(db);
  return db;
}

export function getDb() {
  if (!globalForDb.lawDb) {
    globalForDb.lawDb = openDatabase();
  }
  ensureDraftColumns(globalForDb.lawDb);
  ensureCaseShape(globalForDb.lawDb);
  ensureTaskTable(globalForDb.lawDb);
  ensureElementTable(globalForDb.lawDb);
  ensureFocusTable(globalForDb.lawDb);
  ensureSourceTable(globalForDb.lawDb);
  ensureDraftTable(globalForDb.lawDb);
  ensureClosingTables(globalForDb.lawDb);
  ensurePreservationTable(globalForDb.lawDb);
  ensureMatterAskTable(globalForDb.lawDb);
  ensurePartyRoles(globalForDb.lawDb);
  ensureDeletedStatus(globalForDb.lawDb);
  ensureContractReviewTable(globalForDb.lawDb);
  return globalForDb.lawDb;
}

function ensureContractReviewTable(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS contract_reviews (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      body TEXT NOT NULL,
      kind TEXT NOT NULL,
      stance TEXT NOT NULL,
      reader TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contract_points (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL REFERENCES contract_reviews(id),
      position INTEGER NOT NULL,
      quote TEXT NOT NULL DEFAULT '',
      issue TEXT NOT NULL,
      suggestion TEXT NOT NULL,
      level TEXT NOT NULL CHECK (level IN ('红线', '要改', '提示')),
      law TEXT NOT NULL DEFAULT '',
      law_text TEXT NOT NULL DEFAULT '',
      law_status TEXT NOT NULL DEFAULT '',
      law_url TEXT NOT NULL DEFAULT '',
      law_detail TEXT NOT NULL DEFAULT '',
      law_checked INTEGER NOT NULL DEFAULT 0,
      decision TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS contract_asks (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL REFERENCES contract_reviews(id),
      position INTEGER NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      law_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contract_ask_laws (
      id TEXT PRIMARY KEY,
      ask_id TEXT NOT NULL REFERENCES contract_asks(id),
      position INTEGER NOT NULL,
      law TEXT NOT NULL,
      law_text TEXT NOT NULL DEFAULT '',
      law_status TEXT NOT NULL DEFAULT '',
      law_url TEXT NOT NULL DEFAULT '',
      law_detail TEXT NOT NULL DEFAULT ''
    );
  `);
  const reviews = columnNames(db, "contract_reviews");
  if (!reviews.has("law_note")) {
    db.exec("ALTER TABLE contract_reviews ADD COLUMN law_note TEXT NOT NULL DEFAULT ''");
  }
  const points = columnNames(db, "contract_points");
  if (!points.has("law_text")) {
    db.exec("ALTER TABLE contract_points ADD COLUMN law_text TEXT NOT NULL DEFAULT ''");
  }
  if (!points.has("law_status")) {
    db.exec("ALTER TABLE contract_points ADD COLUMN law_status TEXT NOT NULL DEFAULT ''");
  }
  if (!points.has("law_url")) {
    db.exec("ALTER TABLE contract_points ADD COLUMN law_url TEXT NOT NULL DEFAULT ''");
  }
  if (!points.has("law_detail")) {
    db.exec("ALTER TABLE contract_points ADD COLUMN law_detail TEXT NOT NULL DEFAULT ''");
  }
  if (!points.has("law_checked")) {
    db.exec("ALTER TABLE contract_points ADD COLUMN law_checked INTEGER NOT NULL DEFAULT 0");
  }
  if (!points.has("decision")) {
    db.exec("ALTER TABLE contract_points ADD COLUMN decision TEXT NOT NULL DEFAULT ''");
  }
}

function ensureDeletedStatus(db: DatabaseSync) {
  if (!columnNames(db, "matters").has("deleted_on")) {
    db.exec("ALTER TABLE matters ADD COLUMN deleted_on TEXT NOT NULL DEFAULT ''");
  }
  const old = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'matters'")
    .get() as { sql: string } | undefined;
  if (!old || old.sql.includes("'已删除'")) return;
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE matters_next (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('草稿', '待立案', '办理中', '结案中', '已结案', '已归档', '已终止', '已删除')),
        cause TEXT NOT NULL,
        created_at TEXT NOT NULL,
        facts TEXT NOT NULL DEFAULT '',
        mandate TEXT NOT NULL DEFAULT '',
        claim_amount REAL,
        limitation_start TEXT,
        fee_receivable REAL,
        fee_received REAL,
        case_number TEXT NOT NULL DEFAULT '',
        instance TEXT NOT NULL DEFAULT '',
        procedure TEXT NOT NULL DEFAULT '',
        parent_matter_id TEXT,
        category TEXT NOT NULL DEFAULT '',
        engaged_on TEXT NOT NULL DEFAULT '',
        court_name TEXT NOT NULL DEFAULT '',
        deleted_on TEXT NOT NULL DEFAULT ''
      );
      INSERT INTO matters_next (
        id, name, status, cause, created_at, facts, mandate, claim_amount, limitation_start,
        fee_receivable, fee_received, case_number, instance, procedure, parent_matter_id,
        category, engaged_on, court_name, deleted_on
      )
      SELECT
        id, name, status, cause, created_at, facts, mandate, claim_amount, limitation_start,
        fee_receivable, fee_received, case_number, instance, procedure, parent_matter_id,
        category, engaged_on, court_name, deleted_on
      FROM matters;
      DROP TABLE matters;
      ALTER TABLE matters_next RENAME TO matters;
    `);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  db.exec("PRAGMA foreign_keys = ON");
}

function ensurePartyRoles(db: DatabaseSync) {
  const old = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'parties'")
    .get() as { sql: string } | undefined;
  if (!old || old.sql.includes("'ally'")) return;
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
      CREATE TABLE parties_next (
        id TEXT PRIMARY KEY,
        matter_id TEXT NOT NULL REFERENCES matters(id),
        role TEXT NOT NULL CHECK (role IN ('client', 'ally', 'opposing', 'court')),
        name TEXT NOT NULL,
        client_id TEXT REFERENCES clients(id),
        position TEXT NOT NULL DEFAULT '',
        id_number TEXT NOT NULL DEFAULT ''
      );
      INSERT INTO parties_next (id, matter_id, role, name, client_id, position, id_number)
      SELECT id, matter_id, role, name, client_id, position, id_number FROM parties;
      DROP TABLE parties;
      ALTER TABLE parties_next RENAME TO parties;
    `);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  db.exec("PRAGMA foreign_keys = ON");
}

function ensureMatterAskTable(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS matter_asks (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id),
      question TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('lookup', 'answer')),
      answer TEXT NOT NULL DEFAULT '',
      laws_json TEXT NOT NULL,
      cases_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}

function ensurePreservationTable(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS preservations (
      matter_id TEXT PRIMARY KEY REFERENCES matters(id),
      status TEXT NOT NULL CHECK (status IN ('未保全', '已保全')),
      subject TEXT NOT NULL DEFAULT '',
      court TEXT NOT NULL DEFAULT '',
      preserved_on TEXT NOT NULL DEFAULT ''
    );
  `);
}

function restorePrematureClosing(db: DatabaseSync) {
  db.exec(`
    UPDATE matters SET status = '办理中'
    WHERE status = '结案中'
      AND NOT EXISTS (
        SELECT 1 FROM closing_records WHERE closing_records.matter_id = matters.id
      );
  `);
}

function ensureClosingTables(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS closing_records (
      matter_id TEXT PRIMARY KEY REFERENCES matters(id),
      outcome_kind TEXT NOT NULL,
      outcome_on TEXT NOT NULL,
      outcome_note TEXT NOT NULL,
      statement TEXT NOT NULL DEFAULT '',
      confirmed_at TEXT,
      archived_at TEXT
    );
    CREATE TABLE IF NOT EXISTS closing_task_resolutions (
      task_id TEXT PRIMARY KEY REFERENCES tasks(id),
      matter_id TEXT NOT NULL REFERENCES matters(id),
      result TEXT NOT NULL CHECK (result IN ('已完成', '不再适用')),
      note TEXT NOT NULL DEFAULT '',
      resolved_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS dossier_items (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id),
      section TEXT NOT NULL,
      label TEXT NOT NULL,
      ref_id TEXT,
      position INTEGER NOT NULL
    );
  `);
}

function ensureDraftTable(db: DatabaseSync) {
  const old = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'drafts'",
  ).get() as { sql: string } | undefined;
  if (old?.sql.includes("kind IN ('意见书')")) {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(`
        CREATE TABLE drafts_next (
          id TEXT PRIMARY KEY, matter_id TEXT NOT NULL REFERENCES matters(id),
          kind TEXT NOT NULL CHECK (kind IN ('意见书', '起诉状', '答辩状', '上诉状', '二审答辩状')),
          version INTEGER NOT NULL, body TEXT NOT NULL, source_ids TEXT NOT NULL,
          element_ids TEXT NOT NULL, warnings TEXT NOT NULL,
          final INTEGER NOT NULL DEFAULT 0, based_on INTEGER, created_at TEXT NOT NULL,
          UNIQUE (matter_id, version)
        );
        INSERT INTO drafts_next SELECT * FROM drafts;
        DROP TABLE drafts;
        ALTER TABLE drafts_next RENAME TO drafts;
      `);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id),
      kind TEXT NOT NULL CHECK (kind IN ('意见书', '起诉状', '答辩状', '上诉状', '二审答辩状')),
      version INTEGER NOT NULL,
      body TEXT NOT NULL,
      source_ids TEXT NOT NULL,
      element_ids TEXT NOT NULL,
      warnings TEXT NOT NULL,
      final INTEGER NOT NULL DEFAULT 0,
      based_on INTEGER,
      created_at TEXT NOT NULL,
      UNIQUE (matter_id, version)
    );
  `);
}

function ensureSourceTable(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id),
      focus_id TEXT NOT NULL REFERENCES focuses(id),
      kind TEXT NOT NULL CHECK (kind IN ('law', 'case')),
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT '',
      retrieved_at TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      UNIQUE (focus_id, source_id)
    );
  `);
}

function ensureFocusTable(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS focuses (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id),
      body TEXT NOT NULL,
      position INTEGER NOT NULL,
      confirmed_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
  const columns = db.prepare("PRAGMA table_info(focuses)").all() as { name: string }[];
  if (!columns.some((column) => column.name === "law_query")) {
    db.exec("ALTER TABLE focuses ADD COLUMN law_query TEXT NOT NULL DEFAULT ''");
  }
}

function ensureElementTable(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS elements (
      id TEXT PRIMARY KEY,
      matter_id TEXT NOT NULL REFERENCES matters(id),
      kind TEXT NOT NULL CHECK (kind IN ('请求', '事实', '金额', '日期')),
      body TEXT NOT NULL,
      source_label TEXT NOT NULL,
      source_material_id TEXT,
      position INTEGER NOT NULL,
      confirmed_at TEXT,
      created_at TEXT NOT NULL
    );
  `);
}
