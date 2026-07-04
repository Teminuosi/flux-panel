package com.admin.entity;

import com.admin.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serializable;

/**
 * <p>
 * 
 * </p>
 *
 * @author QAQ
 * @since 2025-06-04
 */
@Data
public class SpeedLimit implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /**
     * 创建时间（时间戳）
     */
    private Long createdTime;

    /**
     * 更新时间（时间戳）
     */
    private Long updatedTime;

    /**
     * 状态（0：正常，1：删除）
     */
    private Integer status;

    private String name;

    private Integer speed;

    private Long tunnelId;

    private String tunnelName;

    /** 限速模式:0=共享(整条限速器一个池) 1=每连接 2=每客户端IP */
    private Integer mode;

    /** 总带宽天花板(Mbps,0=不设),防机房限流;与 mode 的 per-IP/每连接叠加生效 */
    private Integer total;

}
