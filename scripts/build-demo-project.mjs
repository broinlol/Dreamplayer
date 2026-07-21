import { mkdir, writeFile } from "node:fs/promises";
import { createDemoProject } from "../src/core/demo-project.js";
import { serializeProject } from "../src/core/project-serializer.js";

await mkdir(new URL("../examples/", import.meta.url), { recursive:true });
const target = new URL("../examples/night-storm-demo.dreamcue", import.meta.url);
const project = await createDemoProject();
const stableProject = JSON.parse(serializeProject(project));
stableProject.metadata.updatedAt = project.metadata.updatedAt;
await writeFile(target, `${JSON.stringify(stableProject, null, 2)}\n`, "utf8");
console.log(target.pathname);
