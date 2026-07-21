package com.admin.service;

import com.admin.common.dto.SpeedLimitDto;
import com.admin.common.dto.SpeedLimitUpdateDto;
import com.admin.common.lang.R;
import com.admin.entity.SpeedLimit;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * <p>
 * 限速规则服务类
 * </p>
 *
 * @author QAQ
 * @since 2025-06-04
 */
public interface SpeedLimitService extends IService<SpeedLimit> {

    /**
     * 创建限速规则
     * @param speedLimitDto 限速规则数据
     * @return 结果
     */
    R createSpeedLimit(SpeedLimitDto speedLimitDto);

    /**
     * 获取所有限速规则
     * @return 结果
     */
    R getAllSpeedLimits();

    /**
     * 更新限速规则
     * @param speedLimitUpdateDto 更新数据
     * @return 结果
     */
    R updateSpeedLimit(SpeedLimitUpdateDto speedLimitUpdateDto);

    /**
     * 删除限速规则
     * @param id 限速规则ID
     * @return 结果
     */
    R deleteSpeedLimit(Long id);

    /**
     * 把某限速规则的限速器下发到指定节点(合体面板:协议转发所在节点可能和规则创建时的隧道不同,
     * 分配协议用户时按需把限速器推到协议节点,规则本身不用绑隧道)。
     */
    R ensureLimiterOnNode(Integer speedId, Long nodeId);
}
