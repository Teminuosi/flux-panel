package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

/**
 * 给某入站分配一个子账号(车友),带限速/到期/流量配额。
 */
@Data
public class InboundUserDto {

    /** 单入站分配时用(assign);机器卡整机分配(assign-all)可不传 */
    private Long inboundId;

    @NotNull(message = "用户不能为空")
    private Long userId;

    /** 机器卡整机分配:只分配该节点(机器)上的所有协议;不传=所有节点 */
    private Long nodeId;

    /** 限速规则ID(可空=不限速) */
    private Integer speedId;

    /** 到期时间 epoch ms(可空=永不过期) */
    private Long expTime;

    /** 流量配额,单位字节(可空=不改);写到该用户 User.flow */
    private Long flow;
}
