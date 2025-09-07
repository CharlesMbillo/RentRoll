#!/usr/bin/env node
// check-imports.mjs - Ensures every import has a matching dependency
import fs from "fs";
import path from "path";
import { glob } from "glob";

// Determine if we're running from root or client directory
const isInClient = fs.existsSync("package.json") && fs.existsSync("src");
const CLIENT_DIR = isInClient ? "." : "client";
const CLIENT_PKG_PATH = path.join(CLIENT_DIR, "package.json");

async function checkImports() {
  // Read client package.json
  if (!fs.existsSync(CLIENT_PKG_PATH)) {
    console.error(`❌ ${CLIENT_PKG_PATH} not found`);
    console.error("Run this script from the root directory or client directory");
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(CLIENT_PKG_PATH, "utf-8"));
  const availableDeps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.peerDependencies || {})
  ]);

  // Find all TypeScript/JavaScript files in client/src
  const files = await glob(`${CLIENT_DIR}/src/**/*.{ts,tsx,js,jsx}`, { ignore: ["**/node_modules/**"] });
  
  const missingDeps = new Set();
  const importRegex = /^import\s+.*?\s+from\s+['"]([@\w][^'"]*)['"]/gm;
  
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1];
      
      // Skip relative imports (start with . or /)
      if (importPath.startsWith(".") || importPath.startsWith("/")) continue;
      
      // Skip internal aliases (@/ is internal)
      if (importPath.startsWith("@/")) continue;
      
      // Extract package name (handle scoped packages)
      const packageName = importPath.startsWith("@") 
        ? importPath.split("/").slice(0, 2).join("/")
        : importPath.split("/")[0];
      
      // Check if dependency exists
      if (!availableDeps.has(packageName)) {
        missingDeps.add(packageName);
      }
    }
  }

  // Report results
  if (missingDeps.size === 0) {
    console.log("✅ All imports have matching dependencies");
    return true;
  } else {
    console.log("❌ Missing dependencies:");
    for (const dep of [...missingDeps].sort()) {
      console.log(`   - ${dep}`);
    }
    console.log("\n💡 Run: npm install " + [...missingDeps].join(" ") + " --workspace=client");
    return false;
  }
}

// Run check
checkImports().then(success => {
  process.exit(success ? 0 : 1);
}).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});