/**
 * Auth Session Saver
 * 
 * Opens a browser, lets you log in manually, then saves cookies and localStorage
 * to auth/session.json. This session file can then be loaded by runner.ts to
 * bypass authentication.
 * 
 * Usage:
 *   npm run auth:save
 * 
 * The browser will open to your TARGET_URL. Log in manually, then close the browser.
 * The session state will be saved to AUTH_SESSION_PATH (default: ./auth/session.json).
 */

import dotenv from "dotenv";
dotenv.config();

import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const TARGET_URL = process.env.TARGET_URL || "http://localhost:5173";
const AUTH_SESSION_PATH = process.env.AUTH_SESSION_PATH || "./auth/session.json";

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  AUTH SESSION SAVER");
  console.log("═══════════════════════════════════════════\n");
  
  console.log(`Target URL: ${TARGET_URL}`);
  console.log(`Session will be saved to: ${AUTH_SESSION_PATH}\n`);
  
  console.log("Instructions:");
  console.log("  1. A browser window will open");
  console.log("  2. Log in to the application manually");
  console.log("  3. Close the browser window when done");
  console.log("  4. Your session will be saved automatically\n");
  
  console.log("Opening browser...\n");
  
  const browser = await chromium.launch({
    headless: false, // Must be visible for manual login
    channel: "chrome",
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto(TARGET_URL);
  
  console.log("✓ Browser opened");
  console.log("\nPlease log in, then close the browser window.\n");
  
  // Wait for the browser to be closed by the user
  await page.waitForEvent('close', { timeout: 0 });
  
  // Save the session state
  const sessionDir = path.dirname(AUTH_SESSION_PATH);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  
  await context.storageState({ path: AUTH_SESSION_PATH });
  
  await browser.close();
  
  console.log("\n✓ Session saved successfully!");
  console.log(`\nSession file: ${AUTH_SESSION_PATH}`);
  console.log("\nYou can now run the agent with authentication:");
  console.log("  npm run verify\n");
  
  // Show what was saved
  const sessionData = JSON.parse(fs.readFileSync(AUTH_SESSION_PATH, "utf-8"));
  console.log(`Cookies saved: ${sessionData.cookies?.length || 0}`);
  console.log(`Origins with storage: ${sessionData.origins?.length || 0}\n`);
}

main().catch((err) => {
  console.error("\nError saving session:", err);
  process.exit(1);
});
