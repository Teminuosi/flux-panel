package com.admin.common.dto;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Min;
import javax.validation.constraints.Max;

@Data
public class ForwardUpdateDto {
    
    @NotNull(message = "ID不能为空")
    private Long id;
    
    @NotNull(message = "用户ID不能为空")
    private Integer userId;
    
    @NotBlank(message = "转发名称不能为空")
    private String name;
    
    @NotNull(message = "隧道ID不能为空")
    private Integer tunnelId;
    
    @NotBlank(message = "远程地址不能为空")
    private String remoteAddr;

    private String strategy;
    
    /**
     * 入口端口（可选，为空时自动分配）
     */
    @Min(value = 1, message = "端口号不能小于1")
    @Max(value = 65535, message = "端口号不能大于65535")
    private Integer inPort;

    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private String interfaceName;

    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private Integer speedId;

    @TableField(updateStrategy = FieldStrategy.IGNORED)
    private Long expTime;
} 