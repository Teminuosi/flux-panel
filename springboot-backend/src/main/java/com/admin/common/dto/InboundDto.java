package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

/**
 * 新建协议入站(合体面板)。支持 shadowsocks(默认,稳)与 vless-reality(无域名)。
 */
@Data
public class InboundDto {

    @NotNull(message = "节点不能为空")
    private Long nodeId;

    /** 协议:shadowsocks(默认) / vless */
    private String protocol;

    /** sing-box 本机监听口,可空(自动分配 40000+) */
    private Integer listenPort;

    /** Reality 借用的 SNI(仅 vless-reality 需要,如 www.microsoft.com) */
    private String sni;

    /** Reality 握手目标站点,可空则用 sni */
    private String dest;

    /** 落地ID:空=直连(协议管理),有=中转(该入站经此落地出网) */
    private Long landingId;

    private String remark;
}
