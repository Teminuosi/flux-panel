package com.admin.common.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Min;

@Data
public class SpeedLimitDto {

    @NotBlank(message = "限速规则名称不能为空")
    private String name;

    @NotNull(message = "速度限制不能为空")
    @Min(value = 1, message = "速度限制必须大于0")
    private Integer speed;

    /** 隧道可选:合体面板协议限速留空即可;转发限速才需要绑隧道 */
    private Long tunnelId;

    private String tunnelName;

    /** 限速模式:0=共享 1=每连接 2=每客户端IP(默认0) */
    private Integer mode;

    /** 总带宽天花板 Mbps,0=不设(防机房限流) */
    private Integer total;
} 