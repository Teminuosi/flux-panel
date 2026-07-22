-- ============================================================
-- flux 合体面板 · 阶段1 数据库 schema(协议搭建 + 限速)
-- 加法式迁移:只新增表/列,不动现有数据。可在现有 flux 库上直接执行。
-- 新装最终会并进 gost.sql;此文件供现有库升级用。
-- 目标库:MySQL 5.7 / utf8mb4。
-- ============================================================

-- ------------------------------------------------------------
-- 1) node 加"有域名/无域名"相关列
--    cert_mode: 0=无域名(Reality/自签),1=有域名(正经 TLS 证书)
--    MySQL 5.7 的 ADD COLUMN 不支持 IF NOT EXISTS,重复执行会报 1060,忽略即可。
-- ------------------------------------------------------------
ALTER TABLE `node`
  ADD COLUMN `domain`    varchar(255) DEFAULT NULL COMMENT '有域名节点的域名，无域名留空',
  ADD COLUMN `cert_mode` int(10)      NOT NULL DEFAULT 0 COMMENT '0=无域名(Reality/自签) 1=有域名TLS',
  ADD COLUMN `cert_path` varchar(500) DEFAULT NULL COMMENT '有域名时证书路径',
  ADD COLUMN `key_path`  varchar(500) DEFAULT NULL COMMENT '有域名时私钥路径';

-- ------------------------------------------------------------
-- 2) inbound：协议入站(一条 = 一个 sing-box 本机入站)
--    listen_port 只在 127.0.0.1 监听,公网口由 gost 转发占用(限速)。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inbound` (
  `id`           int(10)      NOT NULL AUTO_INCREMENT,
  `node_id`      int(10)      NOT NULL COMMENT '落在哪台节点',
  `tag`          varchar(100) NOT NULL COMMENT 'sing-box inbound tag',
  `protocol`     varchar(50)  NOT NULL COMMENT 'vless/vmess/trojan/shadowsocks/hysteria2',
  `listen_port`  int(10)      NOT NULL COMMENT 'sing-box 本机监听口(127.0.0.1)',
  `security`     varchar(20)  NOT NULL DEFAULT 'reality' COMMENT 'none/tls/reality',
  `sni`          varchar(255) DEFAULT NULL COMMENT 'TLS/Reality 的 SNI',
  `dest`         varchar(255) DEFAULT NULL COMMENT 'Reality 借用的目标站点',
  `public_key`   varchar(255) DEFAULT NULL COMMENT 'Reality 公钥',
  `private_key`  varchar(255) DEFAULT NULL COMMENT 'Reality 私钥',
  `short_id`     varchar(100) DEFAULT NULL COMMENT 'Reality shortId',
  `config_json`  longtext              COMMENT '该入站完整 sing-box JSON(后端生成、下发节点)',
  `remark`       varchar(255) DEFAULT NULL,
  `status`       int(10)      NOT NULL DEFAULT 1 COMMENT '1=启用 0=停用',
  `created_time` bigint(20)   NOT NULL,
  `updated_time` bigint(20)   DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_inbound_node` (`node_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 3) inbound_user：用户在某入站里的凭证 + 对应的 gost 前置转发
--    gost_forward_id 指向 forward 表:那条转发带该用户的限速/流量/到期。
--    客户端最终连的是那条 forward 的公网端口(被限速),落地到本入站。
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inbound_user` (
  `id`              int(10)      NOT NULL AUTO_INCREMENT,
  `inbound_id`      int(10)      NOT NULL,
  `user_id`         int(10)      NOT NULL COMMENT '关联 user 表(子账号)',
  `uuid`            varchar(100) DEFAULT NULL COMMENT 'vless/vmess 用',
  `password`        varchar(255) DEFAULT NULL COMMENT 'trojan/ss/hysteria2 用',
  `gost_forward_id` int(10)      DEFAULT NULL COMMENT '对应的 gost 前置转发(带限速/流量/到期)',
  `sub_token`       varchar(100) DEFAULT NULL COMMENT '订阅链接 token',
  `status`          int(10)      NOT NULL DEFAULT 1,
  `created_time`    bigint(20)   NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_iu_inbound` (`inbound_id`),
  KEY `idx_iu_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 4) speed_limit：tunnel_id 改为可空(合体面板协议限速不绑隧道,
--    分配协议用户时按需把限速器推到协议节点)。重复执行无害。
-- ------------------------------------------------------------
ALTER TABLE `speed_limit` MODIFY COLUMN `tunnel_id` bigint(20) NULL DEFAULT NULL;
