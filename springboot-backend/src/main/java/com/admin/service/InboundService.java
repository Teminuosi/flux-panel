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

    /** 入站列表 */
    R getInbounds();

    /** 删除入站(连带其用户的 gost 转发 + 重推配置) */
    R deleteInbound(Long id);

    /** 给入站分配子账号(生成 uuid + 建限速转发 + 重推 + 出客户端链接) */
    R assignUser(InboundUserDto dto);

    /** 取消某个入站用户 */
    R unassignUser(Long inboundUserId);
}
