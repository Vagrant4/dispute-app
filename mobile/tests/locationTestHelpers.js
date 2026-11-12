const { readFileSync } = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { DatabaseSync } = require("node:sqlite");
function createLoader(mocks = {}) {
  const cache = new Map();
  function load(relative) {
    if (cache.has(relative)) return cache.get(relative).exports;
    const module = { exports: {} };
    cache.set(relative, module);
    const code = ts.transpileModule(readFileSync(path.join(__dirname, "..", relative), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("exports", "module", "require", code)(module.exports, module, (name) => {
      if (name in mocks) return mocks[name];
      if (name === "@claimproof/shared") return load("../packages/shared/src/timeCalculations.ts");
      return name.startsWith(".") ? load(path.normalize(path.join(path.dirname(relative), name + ".ts"))) : require(name);
    });
    return module.exports;
  }
  return load;
}
function sqliteDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  return {
    sqlite,
    async execAsync(sql) { sqlite.exec(sql); },
    async runAsync(sql, params = []) { return sqlite.prepare(sql).run(...params); },
    async getFirstAsync(sql, params = []) { return sqlite.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql, params = []) { return sqlite.prepare(sql).all(...params); },
  };
}
async function fixture(kind = "sqlite") {
  const load = createLoader();
  let database;
  let store;
  if (kind === "sqlite") {
    database = sqliteDatabase();
    database.sqlite.exec(load("src/db/schema.ts").MOBILE_SCHEMA_SQL);
    store = new (load("src/work/workRepository.ts").WorkRepository)(database);
  } else {
    const values = new Map();
    global.localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
    store = load("src/work/webWorkStore.ts").webWorkStore;
  }
  const userId = "location-user";
  const client = await store.createClient({ userId, name: "Client" });
  const project = await store.createProject({ userId, clientId: client.id, name: "Job", hourlyRateCents: 2000 });
  return { load, database, store, userId, projectId: project.id };
}
function source(relative) { return readFileSync(path.join(__dirname, "..", relative), "utf8"); }
module.exports = { createLoader, sqliteDatabase, fixture, source };
