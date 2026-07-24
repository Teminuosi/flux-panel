package com.admin.service;

import com.admin.common.dto.InboundDto;
import com.admin.common.dto.InboundUserDto;
import com.admin.common.lang.R;
import com.admin.entity.Inbound;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * 协议入站服务(合体面板:协议搭建 + 限速)。
 *
 * @author QAQ
 * @since 2026-07-19
 */
public interface InboundService extends IService<Inbound> {

    /** 新建入站(节点生成 Reality 密钥 → 存 → 推 sing-box 配置) */
    R createInbound(InboundDto dto);

    /** 一键添加:在指定节点上把所有支持的协议一键全建出来 */
    R oneClickCreate(Long nodeId);

    /** 一键搭中转:在前置机上把全套协议建出来,流量经指定落地(landingId)出网 */
    R oneClickRelay(Long nodeId, Long landingId);

    /** 入站列表 */
    R getInbounds();

    /** 删除入站(连带其用户的 gost 转发 + 重推配置) */
    R deleteInbound(Long id);

    /** 一键清空某节点上的所有协议入站(连带其转发/用户) */
    R deleteInboundsByNode(Long nodeId);

    /** 给入站分配子账号(生成 uuid + 建限速转发 + 重推 + 出客户端链接) */
    R assignUser(InboundUserDto dto);

    /** 机器卡分配:把某台机器(dto.nodeId)的全套协议一次分给车友;不传 nodeId=所有机器。返回订阅 token,车友一条订阅拿到全部协议 */
    R assignAllToUser(InboundUserDto dto);

    /** 取消某个入站用户 */
    R unassignUser(Long inboundUserId);

    /** 按订阅 token 生成该用户所有协议链接的 base64 订阅内容(客户端订阅用) */
    String buildSubscription(String token);

    /** 取某用户的订阅 token(已分配过协议就有;用于随时查看订阅链接) */
    String getUserSubToken(Long userId);
}
