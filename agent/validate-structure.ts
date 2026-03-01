/**
 * Structure Validation Script
 * 
 * Validates the POC code without running it (no app or API keys needed)
 */

import * as fs from 'fs';
import * as path from 'path';

interface ValidationResult {
  check: string;
  passed: boolean;
  message: string;
}

const results: ValidationResult[] = [];

function validate(check: string, condition: boolean, passMsg: string, failMsg: string) {
  results.push({
    check,
    passed: condition,
    message: condition ? passMsg : failMsg,
  });
}

function fileExists(filepath: string): boolean {
  return fs.existsSync(filepath);
}

function fileContains(filepath: string, searchString: string): boolean {
  if (!fs.existsSync(filepath)) return false;
  const content = fs.readFileSync(filepath, 'utf-8');
  return content.includes(searchString);
}

console.log("═══════════════════════════════════════════");
console.log("  POC STRUCTURE VALIDATION");
console.log("═══════════════════════════════════════════\n");

// Check critical files exist
validate(
  "Spec file exists",
  fileExists("./specs/dashboard.md"),
  "✓ Spec file found",
  "✗ specs/dashboard.md missing"
);

validate(
  "Original verify script exists",
  fileExists("./agent/verify.ts"),
  "✓ Original verify.ts found",
  "✗ agent/verify.ts missing"
);

validate(
  "Robust verify script exists",
  fileExists("./agent/verify-robust.ts"),
  "✓ Robust verify-robust.ts found",
  "✗ agent/verify-robust.ts missing"
);

validate(
  "Test runner exists",
  fileExists("./agent/test-runner.ts"),
  "✓ Test runner found",
  "✗ agent/test-runner.ts missing"
);

validate(
  "Target app exists",
  fileExists("./target-app/src/App.tsx"),
  "✓ Target app found",
  "✗ target-app/src/App.tsx missing"
);

validate(
  "Settings page exists",
  fileExists("./target-app/src/pages/Settings.tsx"),
  "✓ Settings page found",
  "✗ target-app/src/pages/Settings.tsx missing"
);

// Check for intentional bugs in target app
validate(
  "Bug 1: Nav says Config (not Settings)",
  fileContains("./target-app/src/App.tsx", ">Config<"),
  "✓ Bug 1 present: Nav link",
  "✗ Bug 1 missing - nav should say 'Config'"
);

validate(
  "Bug 2: Toggle says Enable Tracking",
  fileContains("./target-app/src/pages/Settings.tsx", "Enable Tracking"),
  "✓ Bug 2 present: Toggle label",
  "✗ Bug 2 missing - toggle should say 'Enable Tracking'"
);

validate(
  "Bug 3: Toast says Saved",
  fileContains("./target-app/src/pages/Settings.tsx", 'setToast("Saved.")'),
  "✓ Bug 3 present: Toast text",
  "✗ Bug 3 missing - toast should say 'Saved.'"
);

// Check Stagehand API usage is correct
validate(
  "Uses correct page access (context.pages())",
  fileContains("./agent/verify.ts", "stagehand.context.pages()[0]"),
  "✓ Correct v3 API: context.pages()[0]",
  "✗ Using wrong API - should use context.pages()"
);

validate(
  "Agent is instantiated correctly",
  fileContains("./agent/verify.ts", "stagehand.agent({") && 
  fileContains("./agent/verify.ts", "agent.execute({"),
  "✓ Correct agent usage: agent() then execute()",
  "✗ Agent API usage incorrect"
);

validate(
  "Has try/finally for cleanup",
  fileContains("./agent/verify.ts", "try {") && 
  fileContains("./agent/verify.ts", "} finally {") &&
  fileContains("./agent/verify.ts", "await stagehand.close()"),
  "✓ Has proper cleanup with try/finally",
  "✗ Missing cleanup code"
);

// Check robust version improvements
validate(
  "Robust version has retry logic",
  fileContains("./agent/verify-robust.ts", "async function retryOperation"),
  "✓ Retry logic implemented",
  "✗ No retry logic found"
);

validate(
  "Robust version has health check",
  fileContains("./agent/verify-robust.ts", "async function waitForApp"),
  "✓ Health check implemented",
  "✗ No health check found"
);

validate(
  "Robust version has screenshot function",
  fileContains("./agent/verify-robust.ts", "async function saveScreenshot"),
  "✓ Screenshot capability implemented",
  "✗ No screenshot function found"
);

validate(
  "Robust version parses spec",
  fileContains("./agent/verify-robust.ts", "function parseSpec"),
  "✓ Spec parsing implemented",
  "✗ No spec parsing found"
);

validate(
  "Robust version has structured report",
  fileContains("./agent/verify-robust.ts", "const VerificationReport = z.object"),
  "✓ Structured report schema defined",
  "✗ No structured report schema"
);

validate(
  "Robust version saves JSON report",
  fileContains("./agent/verify-robust.ts", "fs.writeFileSync") &&
  fileContains("./agent/verify-robust.ts", "report-"),
  "✓ JSON report saving implemented",
  "✗ No JSON report saving"
);

validate(
  "Robust version has exit codes",
  fileContains("./agent/verify-robust.ts", "process.exit(report.overall_pass ? 0 : 1)"),
  "✓ Exit codes implemented (0=pass, 1=fail)",
  "✗ No exit code logic"
);

// Check package.json scripts
const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

validate(
  "Package has agent script",
  !!packageJson.scripts?.agent,
  "✓ 'npm run agent' script exists",
  "✗ Missing 'agent' script"
);

validate(
  "Package has robust agent script",
  !!packageJson.scripts?.["agent:robust"],
  "✓ 'npm run agent:robust' script exists",
  "✗ Missing 'agent:robust' script"
);

validate(
  "Package has test script",
  !!packageJson.scripts?.test,
  "✓ 'npm test' script exists",
  "✗ Missing 'test' script"
);

// Check dependencies
validate(
  "Has Stagehand dependency",
  !!packageJson.dependencies?.["@browserbasehq/stagehand"],
  "✓ Stagehand dependency present",
  "✗ Missing @browserbasehq/stagehand dependency"
);

validate(
  "Has Zod dependency",
  !!packageJson.dependencies?.zod,
  "✓ Zod dependency present",
  "✗ Missing zod dependency"
);

validate(
  "Has dotenv dependency",
  !!packageJson.dependencies?.dotenv,
  "✓ dotenv dependency present (runtime, not dev)",
  "✗ Missing or wrong placement of dotenv"
);

// Print results
console.log("\nValidation Results:\n");

const passed = results.filter(r => r.passed);
const failed = results.filter(r => !r.passed);

results.forEach((result) => {
  const icon = result.passed ? "✓" : "✗";
  const color = result.passed ? "" : "";
  console.log(`${icon} ${result.check}`);
  console.log(`   ${result.message}`);
});

console.log("\n" + "─".repeat(60));
console.log(`Total: ${results.length} | Passed: ${passed.length} | Failed: ${failed.length}`);
console.log("═".repeat(60) + "\n");

// Evaluation
if (failed.length === 0) {
  console.log("✓ ALL STRUCTURE CHECKS PASSED\n");
  console.log("Code structure analysis:");
  console.log("  • All critical files present");
  console.log("  • Intentional bugs correctly placed");
  console.log("  • Stagehand v3 API used correctly");
  console.log("  • Robust version has all improvements");
  console.log("  • Package.json configured correctly");
  console.log("\nThe POC is structurally sound and ready to run.\n");
  console.log("Next steps:");
  console.log("  1. Start target app: npm run app");
  console.log("  2. Add API key to .env");
  console.log("  3. Run verification: npm run verify:robust");
  console.log("  4. Run tests: npm test\n");
} else {
  console.log("✗ STRUCTURE ISSUES FOUND\n");
  console.log("Failed checks:");
  failed.forEach(f => {
    console.log(`  • ${f.check}: ${f.message}`);
  });
  console.log("\nFix these issues before running the POC.\n");
}

process.exit(failed.length > 0 ? 1 : 0);
