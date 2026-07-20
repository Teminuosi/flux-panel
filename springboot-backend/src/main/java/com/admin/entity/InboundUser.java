package com.admin.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;

import java.io.Serializable;

/**
 * <p>
 * 用户在某入站里的凭证 + 对应的 gost 前置转发。
 * gostForwardId 指向 forward 表:那条转发带该用户的限速/流量/到期;
 * 客户端最终连的是那条 forward 的公网端口(被限速),落地到本入站。
 * </p>
 *
 * @author QAQ
 * @since 2026-07-19
 */
@Data
public class InboundUser implements Serializable {

    private static final long serialVersionUID = 1L;

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private Long inboundId;

    /** 关联 user 表(子账号) */
    private Long userId;

    /** vless/vmess 用 */
    private String uuid;

    /** trojan/ss/hysteria2 用 */
    private String password;

    /** 对应的 gost 前置转发(带限速/流量/到期) */
    private Long gostForwardId;

    /** 订阅链接 token */
    private String subToken;

    private Integer status;

    private Long createdTime;
}
