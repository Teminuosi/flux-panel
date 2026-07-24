package com.admin.service.impl;

import com.admin.common.dto.LandingDto;
import com.admin.common.lang.R;
import com.admin.common.utils.LandingUtil;
import com.admin.entity.Inbound;
import com.admin.entity.Landing;
import com.admin.mapper.InboundMapper;
import com.admin.mapper.LandingMapper;
import com.admin.service.LandingService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;
import java.util.List;

/**
 * 落地服务实现。
 *
 * @author QAQ
 * @since 2026-07-23
 */
@Service
public class LandingServiceImpl extends ServiceImpl<LandingMapper, Landing> implements LandingService {

    @Resource
    private InboundMapper inboundMapper;

    @Override
    public R createLanding(LandingDto dto) {
        LandingUtil.Parsed parsed;
        try {
            parsed = LandingUtil.parse(dto.getLink());
        } catch (IllegalArgumentException e) {
            return R.err(e.getMessage());
        }
        Landing landing = new Landing();
        landing.setName(dto.getName());
        landing.setType(parsed.type);
        landing.setLink(dto.getLink().trim());
        landing.setOutboundJson(parsed.outbound.toJSONString());
        landing.setRemark(dto.getRemark());
        landing.setStatus(1);
        landing.setCreatedTime(System.currentTimeMillis());
        landing.setUpdatedTime(System.currentTimeMillis());
        if (!this.save(landing)) {
            return R.err("落地保存失败");
        }
        return R.ok(landing);
    }

    @Override
    public R getLandings() {
        List<Landing> list = this.list(new QueryWrapper<Landing>().orderByDesc("id"));
        return R.ok(list);
    }

    @Override
    public R deleteLanding(Long id) {
        long used = inboundMapper.selectCount(new QueryWrapper<Inbound>().eq("landing_id", id));
        if (used > 0) {
            return R.err("这条落地正在被 " + used + " 个中转协议使用,先清空对应机器的中转再删");
        }
        this.removeById(id);
        return R.ok();
    }
}
