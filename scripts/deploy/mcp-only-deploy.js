#!/usr/bin/env node

const deployMethod = (process.env.DEPLOY_METHOD || "CLI").toUpperCase();
const mcpContext = process.env.MCP_CONTEXT === "1";

if (deployMethod !== "MCP" && deployMethod !== "CLI") {
  console.error("Blocked: DEPLOY_METHOD must be either MCP or CLI.");
  process.exit(1);
}

if (deployMethod === "MCP") {
  if (!mcpContext) {
    console.error("Blocked: MCP context not detected for DEPLOY_METHOD=MCP.");
    process.exit(1);
  }
  console.log("DEPLOY_METHOD=MCP");
  console.log("MCP deployment context detected. Proceed with MCP publish action.");
  process.exit(0);
}

console.log("DEPLOY_METHOD=CLI");
console.log("CLI deployment is allowed by policy.");
