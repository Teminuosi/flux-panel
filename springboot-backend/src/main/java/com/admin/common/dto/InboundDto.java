package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

/**
 * 新建协议入站(合体面板)。阶段1 只支持 vless-reality(无域名)。
 */
@Data
public class InboundDto {

    @NotNull(message = "节点不能为空")
    private Long nodeId;

    /** 协议,阶段1 只支持 vless */
    private String protocol;

    /** sing-box 本机监听口,可空(自动分配 40000+) */
    private Integer listenPort;

    /** Reality 借用的 SNI(如 www.microsoft.com) */
    @NotBlank(message = "SNI 不能为空")
    private String sni;

    /** Reality 握手目标站点,可空则用 sni */
    private String dest;

    private String remark;
}
