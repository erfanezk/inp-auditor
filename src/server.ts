import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// create the MCP server
const server = new McpServer({
  name: "INP Auditor",
  version: "1.0.0",
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("INP Auditor MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
});
