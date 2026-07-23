const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function createTsLoader() {
  const cache = new Map();

  function load(relativePath) {
    const normalized = relativePath.replaceAll("\\", "/");
    if (cache.has(normalized)) {
      return cache.get(normalized).exports;
    }

    const sourcePath = path.join(__dirname, "..", normalized);
    const source = readFileSync(sourcePath, "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const module = { exports: {} };
    cache.set(normalized, module);

    function localRequire(request) {
      if (request === "@claimproof/shared") {
        return {
          calculateTotalHours(clockIn, clockOut, breakMinutes) {
            if (clockOut <= clockIn) {
              throw new Error("Clock-out must be after clock-in");
            }
            const durationMinutes =
              (clockOut.getTime() - clockIn.getTime()) / 60000;
            if (breakMinutes > durationMinutes) {
              throw new Error("Break minutes cannot exceed total duration");
            }
            return (durationMinutes - breakMinutes) / 60;
          },
        };
      }
      if (request.startsWith(".")) {
        const nextPath = path
          .join(path.dirname(normalized), `${request}.ts`)
          .replaceAll("\\", "/");
        return load(nextPath);
      }
      return require(request);
    }

    new Function("exports", "module", "require", compiled)(
      module.exports,
      module,
      localRequire,
    );
    return module.exports;
  }

  return load;
}

test("schema version 7 adds rate entry settings", () => {
  const { CURRENT_SCHEMA_VERSION, LOCAL_MIGRATIONS, MOBILE_SCHEMA_SQL } = createTsLoader()(
    "src/db/schema.ts",
  );

  assert.equal(CURRENT_SCHEMA_VERSION, 7);
  for (const field of [
    "break_minutes",
    "location_text",
    "clock_in_gps_latitude",
    "clock_out_gps_longitude",
    "normal_work_start_time",
    "normal_work_end_time",
    "off_day_multiplier",
    "holiday_multiplier",
    "day_type",
    "rate_basis",
    "base_rate_cents",
  ]) {
    assert.match(MOBILE_SCHEMA_SQL, new RegExp(`\\b${field}\\b`));
  }
  assert.equal(LOCAL_MIGRATIONS.at(-1).version, 7);
  assert.match(LOCAL_MIGRATIONS.at(-1).sql, /rate_basis/);
  assert.match(LOCAL_MIGRATIONS.at(-1).sql, /base_rate_cents/);
});

test("WorkRepository starts empty until the user creates a project", async () => {
  const { WorkRepository } = createTsLoader()("src/work/workRepository.ts");
  const database = new FakeWorkDatabase();
  const repository = new WorkRepository(database);

  const homeState = await repository.getHomeState();
  assert.equal(database.clients.length, 0);
  assert.equal(database.projects.length, 0);
  assert.equal(homeState.project, null);
  assert.equal(homeState.activeEntry, null);

  await assert.rejects(
    () => repository.clockIn({ clockInAt: new Date() }),
    /Create a project before Time In/,
  );
});

test("WorkRepository persists clock in/out for a user-created project", async () => {
  const { WorkRepository } = createTsLoader()("src/work/workRepository.ts");
  const database = new FakeWorkDatabase();
  const repository = new WorkRepository(database);
  const clockInAt = new Date();
  clockInAt.setSeconds(0, 0);
  const clockOutAt = new Date(clockInAt.getTime() + 9 * 60 * 60 * 1000);

  const client = await repository.createClient({ name: "Test Client" });
  const project = await repository.createProject({
    clientId: client.id,
    name: "Phone Test Project",
  });

  const clockIn = await repository.clockIn({
    projectId: project.id,
    clockInAt,
    locationText: "Jurong bay 3",
    gpsLatitude: 1.3,
    gpsLongitude: 103.8,
  });
  assert.equal(database.clients.length, 1);
  assert.equal(database.projects.length, 1);
  assert.equal(clockIn.endTime, null);
  assert.equal(clockIn.locationText, "Jurong bay 3");
  assert.equal(clockIn.dayType, "normal");

  const clockOut = await repository.clockOut({
    entryId: clockIn.id,
    clockOutAt,
    breakMinutes: 60,
    activity: "Installed steel brackets.",
    gpsLatitude: 1.31,
    gpsLongitude: 103.81,
  });
  assert.equal(clockOut.durationMinutes, 480);
  assert.equal(clockOut.breakMinutes, 60);
  assert.equal(clockOut.activity, "Installed steel brackets.");
  assert.equal(clockOut.dayType, "normal");

  const homeState = await repository.getHomeState();
  assert.equal(homeState.project.name, "Phone Test Project");
  assert.equal(homeState.activeEntry, null);
  assert.equal(homeState.totalMinutesToday, 480);
  assert.equal(homeState.recentEntries[0].durationMinutes, 480);
});

test("WorkRepository creates local clients and projects for work setup", async () => {
  const { WorkRepository } = createTsLoader()("src/work/workRepository.ts");
  const database = new FakeWorkDatabase();
  const repository = new WorkRepository(database);

  const client = await repository.createClient({
    name: "XYZ Subcontractor Pte Ltd",
    contactName: "Lim Lead",
    contactEmail: "lim@example.com",
  });
  const project = await repository.createProject({
    clientId: client.id,
    name: "Pipe Support Installation",
    description: "Basement pump room supports.",
    hourlyRateCents: 3200,
    currency: "SGD",
  });

  const clients = await repository.listClients();
  const projects = await repository.listProjects();
  const homeState = await repository.getHomeState();

  assert.equal(clients[0].name, "XYZ Subcontractor Pte Ltd");
  assert.equal(project.clientName, "XYZ Subcontractor Pte Ltd");
  assert.equal(projects[0].name, "Pipe Support Installation");
  assert.equal(homeState.project.name, "Pipe Support Installation");
  assert.equal(homeState.project.hourlyRateCents, 3200);
});

test("WorkRepository creates a manual entry for the selected project with inclusive break", async () => {
  const { WorkRepository } = createTsLoader()("src/work/workRepository.ts");
  const database = new FakeWorkDatabase();
  const repository = new WorkRepository(database);
  const client = await repository.createClient({ name: "Manual Entry Client" });
  const project = await repository.createProject({
    clientId: client.id,
    name: "Selected Manual Project",
    hourlyRateCents: 3000,
  });

  const entry = await repository.createManualEntry({
    projectId: project.id,
    clockInAt: new Date("2026-07-11T00:00:00.000Z"),
    clockOutAt: new Date("2026-07-11T09:00:00.000Z"),
    breakMinutes: 60,
    activity: "Installed and checked supports.",
    dayType: "off_day",
    locationText: "Level 4 plant room",
  });

  assert.equal(entry.projectId, project.id);
  assert.equal(entry.projectName, "Selected Manual Project");
  assert.equal(entry.durationMinutes, 480);
  assert.equal(entry.breakMinutes, 60);
  assert.equal(entry.dayType, "off_day");
  assert.equal(entry.status, "finalized");
});

test("WorkRepository deletes a recent time entry", async () => {
  const { WorkRepository } = createTsLoader()("src/work/workRepository.ts");
  const database = new FakeWorkDatabase();
  const repository = new WorkRepository(database);
  const client = await repository.createClient({ name: "Delete Entry Client" });
  const project = await repository.createProject({
    clientId: client.id,
    name: "Delete Entry Project",
  });

  const entry = await repository.createManualEntry({
    projectId: project.id,
    clockInAt: new Date("2026-07-18T00:00:00.000Z"),
    clockOutAt: new Date("2026-07-18T04:00:00.000Z"),
    activity: "Temporary test entry.",
  });

  assert.equal((await repository.getHomeState()).recentEntries.length, 1);
  await repository.deleteEntry({ entryId: entry.id });

  const homeState = await repository.getHomeState();
  assert.equal(homeState.recentEntries.length, 0);
  assert.equal(database.timeEntries.length, 0);
});

test("WorkRepository unlinks photo evidence before deleting a time entry", async () => {
  const { WorkRepository } = createTsLoader()("src/work/workRepository.ts");
  const database = new FakeWorkDatabase();
  const repository = new WorkRepository(database);
  const client = await repository.createClient({ name: "Evidence Client" });
  const project = await repository.createProject({
    clientId: client.id,
    name: "Evidence Project",
  });
  const entry = await repository.createManualEntry({
    projectId: project.id,
    clockInAt: new Date("2026-07-18T00:00:00.000Z"),
    clockOutAt: new Date("2026-07-18T02:00:00.000Z"),
    activity: "Entry with linked evidence.",
  });
  database.photoEvidence.push({
    id: "photo:1",
    user_id: "local-user",
    project_id: project.id,
    time_entry_id: entry.id,
  });

  await repository.deleteEntry({ entryId: entry.id });

  assert.equal(database.photoEvidence[0].time_entry_id, null);
  assert.equal(database.timeEntries.length, 0);
});

class FakeWorkDatabase {
  clients = [];
  projects = [];
  timeEntries = [];
  photoEvidence = [];

  async execAsync() {}

  async runAsync(sql, params) {
    if (/INSERT OR IGNORE INTO clients/i.test(sql)) {
      if (!this.clients.some((client) => client.id === params[0])) {
        this.clients.push({
          id: params[0],
          user_id: params[1],
          name: params[2],
          contact_name: params[3],
          contact_email: params[4],
          status: "active",
          updated_at: new Date().toISOString(),
        });
      }
      return;
    }

    if (/INSERT INTO clients/i.test(sql)) {
      this.clients.unshift({
        id: params[0],
        user_id: params[1],
        name: params[2],
        contact_name: params[3],
        contact_email: params[4],
        status: "active",
        updated_at: new Date().toISOString(),
      });
      return;
    }

    if (/INSERT OR IGNORE INTO projects/i.test(sql)) {
      if (!this.projects.some((project) => project.id === params[0])) {
        this.projects.push({
          id: params[0],
          user_id: params[1],
          client_id: params[2],
          name: params[3],
          description: params[4],
          hourly_rate_cents: params[5],
          currency: "SGD",
          status: "active",
          updated_at: new Date().toISOString(),
        });
      }
      return;
    }

    if (/INSERT INTO projects/i.test(sql)) {
      this.projects.unshift({
        id: params[0],
        user_id: params[1],
        client_id: params[2],
        name: params[3],
        description: params[4],
        hourly_rate_cents: params[5],
        currency: params[6],
        status: "active",
        updated_at: new Date().toISOString(),
      });
      return;
    }

    if (/INSERT INTO time_entries/i.test(sql)) {
      const isManual = /VALUES \(\?, \?, \?, \?, \?, \?, \?, \?, \?, \?, NULL, NULL, \?, \?, \?, 'finalized'\)/i.test(
        sql.replace(/\s+/g, " "),
      );
      if (isManual) {
        this.timeEntries.push({
          id: params[0],
          user_id: params[1],
          project_id: params[2],
          work_date: params[3],
          start_time: params[4],
          end_time: params[5],
          break_minutes: params[6],
          location_text: params[7],
          clock_in_gps_latitude: params[8],
          clock_in_gps_longitude: params[9],
          clock_out_gps_latitude: null,
          clock_out_gps_longitude: null,
          duration_minutes: params[10],
          activity: params[11],
          day_type: params[12],
          status: "finalized",
          created_at: new Date().toISOString(),
        });
        return;
      }
      this.timeEntries.push({
        id: params[0],
        user_id: params[1],
        project_id: params[2],
        work_date: params[3],
        start_time: params[4],
        end_time: null,
        break_minutes: 0,
        location_text: params[5],
        clock_in_gps_latitude: params[6],
        clock_in_gps_longitude: params[7],
        clock_out_gps_latitude: null,
        clock_out_gps_longitude: null,
        duration_minutes: 0,
        activity: params[8],
        day_type: params[9],
        status: "draft",
        created_at: new Date().toISOString(),
      });
      return;
    }

    if (/UPDATE time_entries/i.test(sql)) {
      const entry = this.timeEntries.find(
        (row) => row.id === params[6] && row.user_id === params[7],
      );
      entry.end_time = params[0];
      entry.break_minutes = params[1];
      entry.clock_out_gps_latitude = params[2];
      entry.clock_out_gps_longitude = params[3];
      entry.duration_minutes = params[4];
      entry.activity = params[5];
      return;
    }

    if (/UPDATE photo_evidence/i.test(sql)) {
      for (const photo of this.photoEvidence) {
        if (
          photo.user_id === params[0] &&
          photo.project_id === params[1] &&
          photo.time_entry_id === params[2]
        ) {
          photo.time_entry_id = null;
        }
      }
      return;
    }

    if (/DELETE FROM time_entries/i.test(sql)) {
      if (/WHERE id = \? AND user_id = \?/i.test(sql)) {
        this.timeEntries = this.timeEntries.filter(
          (row) => !(row.id === params[0] && row.user_id === params[1]),
        );
        return;
      }
      if (/WHERE user_id = \? AND project_id = \?/i.test(sql)) {
        this.timeEntries = this.timeEntries.filter(
          (row) => !(row.user_id === params[0] && row.project_id === params[1]),
        );
        return;
      }
    }
  }

  async getFirstAsync(sql, params) {
    if (/FROM projects\s+JOIN clients/i.test(sql)) {
      const project = /WHERE projects\.user_id = \?/i.test(sql)
        ? this.projects.find((row) => row.user_id === params[0])
        : this.projects.find(
            (row) => row.id === params[0] && row.user_id === params[1],
          );
      if (!project) return null;
      const client = this.clients.find((row) => row.id === project.client_id);
      return {
        ...project,
        client_name: client.name,
      };
    }

    if (/FROM time_entries/i.test(sql)) {
      const entry = this.timeEntries.find(
        (row) => row.id === params[0] && row.user_id === params[1],
      );
      return entry ? this.toEntryRow(entry) : null;
    }

    return null;
  }

  async getAllAsync(sql, params) {
    if (/FROM clients/i.test(sql)) {
      return this.clients.filter((row) => row.user_id === params[0]);
    }

    if (/FROM projects\s+JOIN clients/i.test(sql)) {
      return this.projects
        .filter((row) => row.user_id === params[0])
        .map((project) => {
          const client = this.clients.find((row) => row.id === project.client_id);
          return {
            ...project,
            client_name: client.name,
          };
        });
    }

    if (/FROM time_entries/i.test(sql)) {
      return this.timeEntries
        .filter((row) => row.user_id === params[0])
        .map((entry) => this.toEntryRow(entry));
    }

    return [];
  }

  toEntryRow(entry) {
    const project = this.projects.find((row) => row.id === entry.project_id);
    const client = this.clients.find((row) => row.id === project.client_id);
    return {
      ...entry,
      project_name: project.name,
      client_name: client.name,
    };
  }
}
