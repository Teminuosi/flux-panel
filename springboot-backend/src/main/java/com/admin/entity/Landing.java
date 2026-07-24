package com.admin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

import java.io.Serializable;

/**
 * <p>
 * 落地(中转出口)。粘贴一条节点分享链接建成,解析成 sing-box 出站。
 * 一条落地可分给多台前置机复用;inbound.landing_id 指向它 → 该入站流量经此落地出网。
 * </p>
 *
 * @author QAQ
 * @since 2026-07-23
 */
@Data
public class Landing implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 落地名称(自己起,如 泰国住宅) */
    private String name;

    /** socks5/shadowsocks/vmess/vless/trojan/hysteria2 */
    private String type;

    /** 原始分享链接 */
    private String link;

    /** 解析后的 sing-box outbound JSON(下发时按 landing_id 注入节点配置) */
    private String outboundJson;

    private String remark;

    /** 1=启用 0=停用 */
    private Integer status;

    private Long createdTime;

    private Long updatedTime;
}
