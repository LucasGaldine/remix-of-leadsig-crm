#!/usr/bin/env node

const deployMethod = process.env.DEPLOY_METHOD;
const mcpContext = process.env.MCP_CONTEXT === "1";

if (deployMethod !== "MCP") {
  console.error("Blocked: DEPLOY_METHOD must be set to MCP.");
  console.error("Run deployments through MCP tooling only.");
  process.exit(1);
}

if (!mcpContext) {
  console.error("Blocked: MCP context not detected.");
  console.error("Do not run deployment from CLI unless explicitly approved by the user.");
  process.exit(1);
}

console.log("DEPLOY_METHOD=MCP");
console.log("MCP deployment context detected. Proceed with MCP publish action.");
