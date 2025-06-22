FROM node:22-alpine

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

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm run build

CMD ["bash"]