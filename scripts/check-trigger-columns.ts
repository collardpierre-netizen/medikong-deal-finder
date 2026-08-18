/**
 * Contrôle anti-régression — colonnes fantômes dans les fonctions trigger.
 *
 * Parcourt toutes les fonctions trigger du schéma `public`, extrait les
 * références `NEW.<col>` / `OLD.<col>` de leur corps, et les confronte aux
 * colonnes réelles de la (des) table(s) portant le trigger.
 *
 * Toute référence à une colonne inexistante = échec (exit code 1).
 *
 * Origine : le 17/08/2026, `guard_customers_privileged_columns()` référençait
 * `customers.is_active`, colonne qui n'a jamais existé (recopie du guard
 * vendors). Résultat : panne d'écriture silencieuse pendant ~6 semaines.
 * Ce contrôle aurait détecté le cas le jour de son introduction.
 *
 * Usage (nécessite les variables PG* / un accès psql en lecture) :
 *   bun scripts/check-trigger-columns.ts
 */
import { execSync } from "node:child_process";

const psql = (sql: string) =>
  execSync("psql -X -A -t -F '\u0001'", { input: sql, encoding: "utf8" });

type Row = { fn: string; table: string; body: string };

function loadTriggerFunctions(): Row[] {
  const sql = `
    SELECT DISTINCT p.proname,
           c.relname,
           replace(pg_get_functiondef(p.oid), E'\\n', E'\\u0002')
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace cn ON cn.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE NOT t.tgisinternal
      AND cn.nspname = 'public'
      AND pn.nspname = 'public';
  `;
  return psql(sql)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [fn, table, ...rest] = l.split("\u0001");
      return { fn, table, body: rest.join("\u0001") };
    });
}

function loadColumns(): Map<string, Set<string>> {
  const out = psql(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public';`,
  );
  const map = new Map<string, Set<string>>();
  for (const line of out.split("\n")) {
    const [table, col] = line.trim().split("\u0001");
    if (!table || !col) continue;
    if (!map.has(table)) map.set(table, new Set());
    map.get(table)!.add(col);
  }
  return map;
}

/** Retire les commentaires SQL : ils peuvent citer une colonne sans la lire. */
function stripComments(body: string): string {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\u0002")
    .map((line) => line.replace(/--.*$/, " "))
    .join("\n");
}

function referencedColumns(body: string): string[] {
  body = stripComments(body);
  const refs = new Set<string>();
  for (const m of body.matchAll(/\b(?:NEW|OLD)\.([a-zA-Z_][a-zA-Z0-9_]*)/gi)) {
    refs.add(m[1].toLowerCase());
  }
  return [...refs];
}

function main() {
  const columns = loadColumns();
  const failures: string[] = [];

  for (const { fn, table, body } of loadTriggerFunctions()) {
    const cols = columns.get(table);
    if (!cols) continue; // vue ou table hors information_schema : ignoré
    for (const ref of referencedColumns(body)) {
      if (!cols.has(ref)) {
        failures.push(`${table}.${ref} référencée par ${fn}() — colonne inexistante`);
      }
    }
  }

  if (failures.length > 0) {
    console.error(`❌ ${failures.length} référence(s) de colonne fantôme dans des triggers :`);
    for (const f of failures.sort()) console.error(`   - ${f}`);
    console.error(
      "\nCes triggers échouent à l'exécution et bloquent toute écriture sur la table concernée.",
    );
    process.exit(1);
  }

  console.log("✅ Aucune colonne fantôme référencée par une fonction trigger.");
}

main();
