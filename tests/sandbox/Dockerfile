FROM node:22-bookworm
WORKDIR /work
COPY package.tgz /work/package.tgz
RUN npm install --ignore-scripts --no-audit --no-fund ./package.tgz @openai/codex@0.144.4
COPY setup-integration.mjs acceptance.mjs adapter-lock.json /work/
USER node
CMD ["node", "/work/acceptance.mjs"]
