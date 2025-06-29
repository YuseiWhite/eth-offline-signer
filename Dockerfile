FROM node:22-alpine AS base
WORKDIR /app

# Install system dependencies for Foundry
RUN apk add --no-cache \
    bash \
    curl \
    git \
    build-base \
    linux-headers

# Install Foundry with explicit shell
ENV SHELL=/bin/bash
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:$PATH"
RUN /bin/bash -c "source /root/.bashrc && foundryup"

# Install pnpm globally using npm, which is more reliable in this container environment.
# The .npmrc file ensures this command uses the mirror registry.
RUN npm install -g pnpm

# 依存関係ファイルのみを先にコピー
COPY package.json pnpm-lock.yaml ./

# .npmrcファイルをコピーしてレジストリを事前に設定
COPY .npmrc ./

# 依存関係をインストールする（この層がキャッシュされる）
RUN pnpm install --frozen-lockfile

# 最後にソースコード全体をコピーする
COPY . .

# アプリケーションをビルドする
RUN pnpm run build

CMD ["bash"]
