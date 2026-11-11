FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

COPY . .

ARG HBL_BUILD_ID=unknown
ENV HBL_BUILD_ID=${HBL_BUILD_ID}

EXPOSE 3000

CMD ["bun", "run", "server.js"]
