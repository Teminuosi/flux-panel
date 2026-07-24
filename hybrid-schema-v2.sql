-- ============================================================
-- flux 合体面板 · 阶段3 数据库 schema(中转:前置机协议 + 落地出口)
-- 加法式迁移:只新增表/列,不动现有数据。可在现有 flux 库上直接执行。
-- MySQL 5.7 的 ADD COLUMN 不支持 IF NOT EXISTS,重复执行报 1060,忽略即可。
-- 目标库:MySQL 5.7 / utf8mb4。
-- ============================================================

-- ------------------------------------------------------------
-- 1) landing:可复用的「落地」出口。粘贴一条节点分享链接建成,
--    面板解析成 sing-box 出站。一条落地可分给多台前置机复用。
--    link:原始分享链接(socks5://user:pass@ip:port / ss:// / vmess:// / vless:// / trojan:// / hysteria2://…)
--    outbound_json:解析后的 sing-box outbound(下发时按 landing_id 注入节点配置)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `landing` (
  `id`            int(10)      NOT NULL AUTO_INCREMENT,
  `name`          varchar(100) NOT NULL COMMENT '落地名称(自己起,如 泰国住宅)',
  `type`          varchar(30)  NOT NULL COMMENT 'socks5/shadowsocks/vmess/vless/trojan/hysteria2',
  `link`          longtext              COMMENT '原始分享链接',
  `outbound_json` longtext              COMMENT '解析后的 sing-box outbound JSON',
  `remark`        varchar(255) DEFAULT NULL,
  `status`        int(10)      NOT NULL DEFAULT 1 COMMENT '1=启用 0=停用',
  `created_time`  bigint(20)   NOT NULL,
  `updated_time`  bigint(20)   DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- 2) inbound 加 landing_id:空=直连(协议管理,本机出网),
--    有=中转(该入站的流量经这个落地出网)。加法,不影响已有直连入站。
-- ------------------------------------------------------------
ALTER TABLE `inbound`
  ADD COLUMN `landing_id` int(10) DEFAULT NULL COMMENT '落地ID:空=直连,有=经该落地中转出网';
