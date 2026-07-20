package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

/**
 * 给某入站分配一个子账号(车友),带限速/到期/流量配额。
 */
@Data
public class InboundUserDto {

    @NotNull(message = "入站不能为空")
    private Long inboundId;

    @NotNull(message = "用户不能为空")
    private Long userId;

    /** 限速规则ID(可空=不限速) */
    private Integer speedId;

    /** 到期时间 epoch ms(可空=永不过期) */
    private Long expTime;

    /** 流量配额,单位字节(可空=不改);写到该用户 User.flow */
    private Long flow;
}
