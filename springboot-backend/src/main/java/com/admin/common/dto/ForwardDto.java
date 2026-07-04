package com.admin.common.dto;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Min;
import javax.validation.constraints.Max;

@Data
public class ForwardDto {

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

    private String interfaceName;

    /** 绑定限速规则ID(功能B,可选) */
    private Integer speedId;

    /** 到期时间 epoch ms(功能C,可选,空=永不过期) */
    private Long expTime;

} 