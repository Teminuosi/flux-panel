package com.admin.controller;

import com.admin.common.annotation.RequireRole;
import com.admin.common.aop.LogAnnotation;
import com.admin.common.dto.InboundDto;
import com.admin.common.dto.InboundUserDto;
import com.admin.common.lang.R;
import com.admin.service.InboundService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * <p>
 * 协议入站前端控制器(合体面板:协议 + 限速)
 * </p>
 *
 * @author QAQ
 * @since 2026-07-19
 */
@RestController
@RequestMapping("/api/v1/inbound")
@CrossOrigin
public class InboundController extends BaseController {

    @Autowired
    private InboundService inboundService;

    @LogAnnotation
    @RequireRole
    @PostMapping("/create")
    public R create(@Validated @RequestBody InboundDto dto) {
        return inboundService.createInbound(dto);
    }

    /** 一键添加:在指定节点上把所有支持的协议一键全建出来(像 s-ui 的一键添加) */
    @LogAnnotation
    @RequireRole
    @PostMapping("/one-click")
    public R oneClick(@RequestBody Map<String, Object> body) {
        return inboundService.oneClickCreate(Long.valueOf(String.valueOf(body.get("nodeId"))));
    }

    @RequireRole
    @PostMapping("/list")
    public R list() {
        return inboundService.getInbounds();
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/delete")
    public R delete(@RequestBody Map<String, Object> body) {
        return inboundService.deleteInbound(Long.valueOf(String.valueOf(body.get("id"))));
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/assign")
    public R assign(@Validated @RequestBody InboundUserDto dto) {
        return inboundService.assignUser(dto);
    }

    @LogAnnotation
    @RequireRole
    @PostMapping("/unassign")
    public R unassign(@RequestBody Map<String, Object> body) {
        return inboundService.unassignUser(Long.valueOf(String.valueOf(body.get("id"))));
    }
}
