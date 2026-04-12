---
author: Posase
pubDatetime: 2024-06-05T02:54:12Z
title: "Docker 部署 Immich 家庭相册"
draft: false
tags:
  - Docker
  - Immich
  - 自建服务
  - 教程
description: "Docker Compose 部署 Immich 家庭相册服务器，包含核显转码配置和升级方案"
---


## 编辑和修改配置文件
```yaml
# docker-compose.yml
# 注意文件可能有更新，请以官方为准
# 这里添加了使用 daocloud 加速镜像 添加了核显转码
# 主要关注有注释的部分
#
# WARNING: Make sure to use the docker-compose.yml of the current release:
#
# https://github.com/immich-app/immich/releases/latest/download/docker-compose.yml
#
# The compose file on main may not be compatible with the latest release.
#
name: immich

services:
  immich-server:
    container_name: immich_server
    image: m.daocloud.io/ghcr.io/immich-app/immich-server:${IMMICH_VERSION:-release}
    command: ['start.sh', 'immich']
    volumes:
      - ${UPLOAD_LOCATION}:/usr/src/app/upload
      - /etc/localtime:/etc/localtime:ro
    env_file:
      - .env
    ports:
      - 2283:3001
    depends_on:
      - redis
      - database
    restart: always

  immich-microservices:
    container_name: immich_microservices
    image: m.daocloud.io/ghcr.io/immich-app/immich-server:${IMMICH_VERSION:-release}
    # extends: # uncomment this section for hardware acceleration - see https://immich.app/docs/features/hardware-transcoding
    #   file: hwaccel.transcoding.yml
    #   service: quicksync # set to one of [nvenc, quicksync, rkmpp, vaapi, vaapi-wsl] for accelerated transcoding
    devices:
      - /dev/dri:/dev/dri # 启用 cpu 核显加速，不同设备可能不同，详见上面注释种文档介绍
    command: ['start.sh', 'microservices']
    volumes:
      - ${UPLOAD_LOCATION}:/usr/src/app/upload
      - /etc/localtime:/etc/localtime:ro
    env_file:
      - .env
    depends_on:
      - redis
      - database
    restart: always

  immich-machine-learning:
    container_name: immich_machine_learning
    # For hardware acceleration, add one of -[armnn, cuda, openvino] to the image tag.
    # Example tag: ${IMMICH_VERSION:-release}-cuda
    image: m.daocloud.io/ghcr.io/immich-app/immich-machine-learning:${IMMICH_VERSION:-release}
    # GPU硬件加速 参考下面文档
    # extends: # uncomment this section for hardware acceleration - see https://immich.app/docs/features/ml-hardware-acceleration
    #   file: hwaccel.ml.yml
    #   service: cpu # set to one of [armnn, cuda, openvino, openvino-wsl] for accelerated inference - use the `-wsl` version for WSL2 where applicable
    volumes:
      - model-cache:/cache
    env_file:
      - .env
    restart: always

  redis:
    container_name: immich_redis
    image: docker.m.daocloud.io/redis:6.2-alpine
    restart: always

  database:
    container_name: immich_postgres
    image: docker.m.daocloud.io/tensorchord/pgvecto-rs:pg14-v0.2.0
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_USER: ${DB_USERNAME}
      POSTGRES_DB: ${DB_DATABASE_NAME}
      POSTGRES_INITDB_ARGS: '--data-checksums'
    volumes:
      - ${DB_DATA_LOCATION}:/var/lib/postgresql/data
    restart: always
    command: ["postgres", "-c" ,"shared_preload_libraries=vectors.so", "-c", 'search_path="$$user", public, vectors', "-c", "logging_collector=on", "-c", "max_wal_size=2GB", "-c", "shared_buffers=512MB", "-c", "wal_compression=on"]

volumes:
  model-cache:
```

```yaml
# .env 记得修改密码
# You can find documentation for all the supported env variables at https://immich.app/docs/install/environment-variables

# The location where your uploaded files are stored
UPLOAD_LOCATION=./library
# The location where your database files are stored
DB_DATA_LOCATION=./postgres

# The Immich version to use. You can pin this to a specific version like "v1.71.0"
IMMICH_VERSION=release

# Connection secret for postgres. You should change it to a random password
DB_PASSWORD=password # 记得修改密码

# The values below this line do not need to be changed
###################################################################################
DB_USERNAME=postgres
DB_DATABASE_NAME=immich
```
> 之后使用 `docker compose up -d` 启动即可

## 关于升级
由于 `immich` 处于快速开发阶段，这里采用保留源文件，直接重装再上传的方案。

好处是不需要备份除了原始文件以外的所有数据，简单粗暴，防止版本更新所需的各种繁琐步骤。

坏处是用户需要重新创建，以及需要重新生成相关缓存，适用于少量用户的情况

```shell
# 使用 immich_cli 命令行快速上传文件，通过更换 api-key 可以上传到不同用户的资源库
docker run -it --rm -v "$(pwd)":/import:ro \
    -e IMMICH_INSTANCE_URL=http://ip:port/api \
    -e IMMICH_API_KEY=api-key \
    m.daocloud.io/ghcr.io/immich-app/immich-cli:latest \
    upload --skip-hash --recursive /import
```

## 参考
- [Immich 官方文档](https://immich.app/docs/overview/introduction)
- [Immich - GitHub](https://github.com/immich-app/immich)