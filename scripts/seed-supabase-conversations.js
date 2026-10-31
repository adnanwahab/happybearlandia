import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createAdminClient } from "@supabase/server/core";

const projectRoot = process.cwd();
const conversationsRoot = join(projectRoot, "game", "conversations");
const DEFAULT_PLAYER_ID = "__default__";
const MEMORY_SEED_TAG = "seed:conversation-json";
const GOAL_SEED_SOURCE = "conversation-bootstrap";

async function loadProjectEnvFiles() {
  const protectedKeys = new Set(
    Object.entries(process.env)
      .filter(([, value]) => typeof value === "string" && value.trim() !== "")
      .map(([key]) => key),
  );

  const parseAndApply = source => {
    const lines = source.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

      if (!match) {
        continue;
      }

      const [, key, rawValue] = match;

      if (protectedKeys.has(key)) {
        continue;
      }

      let value = rawValue.trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      } else {
        value = value.replace(/\s+#.*$/, "").trim();
      }

      process.env[key] = value;
    }
  };

  for (const fileName of [".env", ".env.local", ".env.op"]) {
    try {
      const source = await readFile(join(projectRoot, fileName), "utf8");
      parseAndApply(source);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn(`Failed to load ${fileName}:`, error);
      }
    }
  }
}

async function walkJsonFiles(root) {
  const out = [];

  async function walk(directoryPath) {
    const entries = await readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith(".json")) {
        out.push(absolutePath);
      }
    }
  }

  await walk(root);
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeRelationshipDefaults(value) {
  const defaults = value && typeof value === "object" ? value : {};

  return {
    familiarity: finiteNumber(defaults.familiarity, 0.2),
    comfort: finiteNumber(defaults.comfort, 0.35),
    trust: finiteNumber(defaults.trust, 0.3),
    attraction: finiteNumber(defaults.attraction, 0.2),
    affection: finiteNumber(defaults.affection, 0.25),
    fun: finiteNumber(defaults.fun, 0.3),
  };
}

function normalizeNpcRow(npc) {
  const id = typeof npc?.id === "string" ? npc.id.trim() : "";

  if (!id) {
    return null;
  }

  const name =
    typeof npc?.name === "string" && npc.name.trim()
      ? npc.name.trim()
      : id;

  return {
    id,
    name,
    personality: npc?.personality && typeof npc.personality === "object" ? npc.personality : {},
    current_state: npc?.current_state && typeof npc.current_state === "object" ? npc.current_state : {},
    relationship_defaults: normalizeRelationshipDefaults(npc?.relationship_defaults),
  };
}

function normalizeMemoryRows(memoryRows, npcId, sceneId) {
  const input = Array.isArray(memoryRows) ? memoryRows : [];

  return input
    .filter(row => row && row.npc_id === npcId && typeof row.memory === "string" && row.memory.trim())
    .map(row => {
      const tags = Array.isArray(row.tags) ? row.tags.filter(tag => typeof tag === "string" && tag.trim()) : [];
      const mergedTags = Array.from(new Set([sceneId, MEMORY_SEED_TAG, ...tags]));

      return {
        npc_id: npcId,
        player_id: row.player_id ?? null,
        memory: row.memory.trim(),
        importance: finiteNumber(row.importance, 0.5),
        tags: mergedTags,
      };
    });
}

function normalizeGoalRows(goalRows, npcId, sceneId) {
  const input = Array.isArray(goalRows) ? goalRows : [];

  return input
    .filter(row => row && row.npc_id === npcId && typeof row.type === "string" && row.type.trim())
    .map(row => {
      const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};

      return {
        npc_id: npcId,
        type: row.type.trim(),
        target_id: typeof row.target_id === "string" && row.target_id.trim() ? row.target_id.trim() : null,
        priority: finiteNumber(row.priority, 0.5),
        status:
          row.status === "completed" || row.status === "cancelled" || row.status === "active"
            ? row.status
            : "active",
        payload: {
          source: GOAL_SEED_SOURCE,
          scene_id: sceneId,
          ...payload,
        },
      };
    });
}

async function seedConversationFile(supabaseAdmin, filePath) {
  const source = await readFile(filePath, "utf8");
  const json = JSON.parse(source);

  const npcs = Array.isArray(json?.npcs) ? json.npcs : [];
  const sceneId = filePath
    .replace(`${conversationsRoot}/`, "")
    .replace(/\\/g, "/")
    .replace(/\.json$/i, "");

  const npcRows = npcs.map(normalizeNpcRow).filter(Boolean);

  if (npcRows.length === 0) {
    return {
      sceneId,
      seededNpcs: 0,
      seededRelationships: 0,
      seededMemories: 0,
      seededGoals: 0,
    };
  }

  const npcIds = npcRows.map(npc => npc.id);

  const { error: npcError } = await supabaseAdmin
    .from("npcs")
    .upsert(
      npcRows.map(npc => ({
        id: npc.id,
        name: npc.name,
        personality: npc.personality,
        current_state: npc.current_state,
      })),
      { onConflict: "id" },
    );

  if (npcError) {
    throw new Error(`Failed to upsert npcs for ${sceneId}: ${npcError.message}`);
  }

  const relationshipRows = npcRows.map(npc => ({
    npc_id: npc.id,
    player_id: DEFAULT_PLAYER_ID,
    ...npc.relationship_defaults,
  }));

  const { error: relationshipError } = await supabaseAdmin
    .from("npc_relationships")
    .upsert(relationshipRows, { onConflict: "npc_id,player_id" });

  if (relationshipError) {
    throw new Error(`Failed to upsert npc_relationships for ${sceneId}: ${relationshipError.message}`);
  }

  const allMemories = npcRows.flatMap(npc =>
    normalizeMemoryRows(json?.npc_memories, npc.id, sceneId),
  );

  const allGoals = npcRows.flatMap(npc =>
    normalizeGoalRows(json?.npc_goals, npc.id, sceneId),
  );

  // Replace only seeded rows so rerunning the script stays idempotent.
  const { error: deleteMemoriesError } = await supabaseAdmin
    .from("npc_memories")
    .delete()
    .in("npc_id", npcIds)
    .contains("tags", [MEMORY_SEED_TAG]);

  if (deleteMemoriesError) {
    throw new Error(`Failed to delete seeded npc_memories for ${sceneId}: ${deleteMemoriesError.message}`);
  }

  const { error: deleteGoalsError } = await supabaseAdmin
    .from("npc_goals")
    .delete()
    .in("npc_id", npcIds)
    .contains("payload", { source: GOAL_SEED_SOURCE });

  if (deleteGoalsError) {
    throw new Error(`Failed to delete seeded npc_goals for ${sceneId}: ${deleteGoalsError.message}`);
  }

  if (allMemories.length > 0) {
    const { error: memoryInsertError } = await supabaseAdmin
      .from("npc_memories")
      .insert(allMemories);

    if (memoryInsertError) {
      throw new Error(`Failed to insert npc_memories for ${sceneId}: ${memoryInsertError.message}`);
    }
  }

  if (allGoals.length > 0) {
    const { error: goalInsertError } = await supabaseAdmin
      .from("npc_goals")
      .insert(allGoals);

    if (goalInsertError) {
      throw new Error(`Failed to insert npc_goals for ${sceneId}: ${goalInsertError.message}`);
    }
  }

  return {
    sceneId,
    seededNpcs: npcRows.length,
    seededRelationships: relationshipRows.length,
    seededMemories: allMemories.length,
    seededGoals: allGoals.length,
  };
}

async function main() {
  await loadProjectEnvFiles();

  let supabaseAdmin;

  try {
    supabaseAdmin = createAdminClient();
  } catch (error) {
    throw new Error(
      `Unable to initialize Supabase admin client. Ensure SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SECRET_KEYS) are set.\n${error?.message ?? error}`,
    );
  }

  const files = await walkJsonFiles(conversationsRoot);

  if (files.length === 0) {
    throw new Error("No conversation JSON files found under game/conversations.");
  }

  const totals = {
    files: 0,
    npcs: 0,
    relationships: 0,
    memories: 0,
    goals: 0,
  };

  for (const filePath of files) {
    const result = await seedConversationFile(supabaseAdmin, filePath);
    totals.files += 1;
    totals.npcs += result.seededNpcs;
    totals.relationships += result.seededRelationships;
    totals.memories += result.seededMemories;
    totals.goals += result.seededGoals;

    console.log(
      `[seed] ${result.sceneId}: npcs=${result.seededNpcs}, relationships=${result.seededRelationships}, memories=${result.seededMemories}, goals=${result.seededGoals}`,
    );
  }

  console.log("\nSeed complete:");
  console.log(`  files: ${totals.files}`);
  console.log(`  npcs: ${totals.npcs}`);
  console.log(`  npc_relationships: ${totals.relationships}`);
  console.log(`  npc_memories: ${totals.memories}`);
  console.log(`  npc_goals: ${totals.goals}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
