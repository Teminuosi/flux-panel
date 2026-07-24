package com.admin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

import java.io.Serializable;

/**
 * <p>
 * 协议入站(合体面板:一条 = 一个 sing-box 本机入站)
 * listen 一律 127.0.0.1,公网口由 gost 转发占用并限速。
 * </p>
 *
 * @author QAQ
 * @since 2026-07-19
 */
@Data
public class Inbound implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /** 落在哪台节点 */
    private Long nodeId;

    /** 落地ID:空=直连(本机出网),有=中转(该入站流量经该落地出网) */
    private Long landingId;

    /** sing-box inbound tag */
    private String tag;

    /** vless/vmess/trojan/shadowsocks/hysteria2 */
    private String protocol;

    /** sing-box 本机监听口(127.0.0.1) */
    private Integer listenPort;

    /** none/tls/reality */
    private String security;

    /** TLS/Reality 的 SNI */
    private String sni;

    /** Reality 借用的目标站点 */
    private String dest;

    /** Reality 公钥(进客户端链接) */
    private String publicKey;

    /** Reality 私钥(进服务端配置) */
    private String privateKey;

    /** Reality shortId */
    private String shortId;

    /** 该入站完整 sing-box JSON(后端生成、下发节点) */
    private String configJson;

    private String remark;

    /** 1=启用 0=停用 */
    private Integer status;

    private Long createdTime;

    private Long updatedTime;
}
