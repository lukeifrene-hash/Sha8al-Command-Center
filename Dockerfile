# Headless MCP Server / CLI Docker Image
# Used by external AI agents to access the TalkStore / Sha8al CLI tools without the desktop GUI.

FROM node:22-alpine

WORKDIR /app

# 1. Install root dependencies (using legacy peer deps to match standard install)
COPY package.json package-lock.json ./
RUN npm install --legacy-peer-deps

# 2. Copy the entire repository
COPY . .

# 3. Build the inner MCP Server backend
WORKDIR /app/mcp-server
RUN npm install && npm run build

# 4. Configure the headless environment
# AI agents executing this container must volume mount the project tracking folder into /workspace
ENV COMMAND_CENTER_PROJECT_ROOT=/workspace
VOLUME ["/workspace"]

# 5. Native entrypoint execution pointing directly at the command center API module
ENTRYPOINT ["node", "/app/mcp-server/dist/cli.js"]
