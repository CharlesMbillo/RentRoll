// check-deps.mjs
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const workspaces = ["client", "server"]; // add more if needed

function checkDeps(workspace) {
  const pkgPath = path.join(workspace, "package.json");
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  };

  console.log(`\n🔎 Checking dependencies for ${workspace}...`);

  for (const dep in deps) {
    try {
      require.resolve(dep, { paths: [workspace] });
    } catch {
      console.error(`❌ Missing dependency in ${workspace}: ${dep}`);
      try {
        console.log(`📦 Installing ${dep} in ${workspace}...`);
        execSync(`npm install ${dep}`, { cwd: workspace, stdio: "inherit" });
      } catch (err) {
        console.error(`⚠️ Failed to install ${dep} in ${workspace}`);
      }
    }
  }
}

for (const ws of workspaces) {
  checkDeps(ws);
}