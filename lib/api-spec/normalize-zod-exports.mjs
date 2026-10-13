import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const specDir = path.dirname(fileURLToPath(import.meta.url));
const barrelPath = path.resolve(specDir, "../api-zod/src/index.ts");

await writeFile(
  barrelPath,
  'export * from "./generated/api";\nexport * as ApiTypes from "./generated/types";\n',
);
