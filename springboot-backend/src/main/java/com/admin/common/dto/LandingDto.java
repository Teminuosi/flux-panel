package com.admin.common.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

/**
 * 新建落地:名称 + 一条分享链接(socks5/ss/vmess/vless/trojan/hysteria2)。
 */
@Data
public class LandingDto {

    /** 改落地时必传(update);新建时留空(create)。
        ⚠️ 别把校验注解写在它上面 —— 它是 Long,而 @NotBlank 只认 CharSequence,
        Hibernate Validator 会在【请求进来时】抛 HV000030,编译期一点提示都没有。 */
    private Long id;

    @NotBlank(message = "落地名称不能为空")
    private String name;

    @NotBlank(message = "分享链接不能为空")
    private String link;

    private String remark;
}
