FROM oven/bun:1@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d

WORKDIR /app

COPY package.json bun.lock* ./

RUN bun install --frozen-lockfile

COPY . .

ARG HBL_BUILD_ID=unknown
ENV HBL_BUILD_ID=${HBL_BUILD_ID}

EXPOSE 3000

CMD ["bun", "run", "server.js"]
