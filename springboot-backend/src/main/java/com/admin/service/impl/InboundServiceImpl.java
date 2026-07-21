package com.admin.service.impl;

import com.admin.common.dto.ForwardDto;
import com.admin.common.dto.GostDto;
import com.admin.common.dto.InboundDto;
import com.admin.common.dto.InboundUserDto;
import com.admin.common.dto.TunnelDto;
import com.admin.common.lang.R;
import com.admin.common.utils.SingboxUtil;
import com.admin.entity.Forward;
import com.admin.entity.Inbound;
import com.admin.entity.InboundUser;
import com.admin.entity.Node;
import com.admin.entity.Tunnel;
import com.admin.entity.User;
import com.admin.mapper.ForwardMapper;
import com.admin.mapper.InboundMapper;
import com.admin.mapper.InboundUserMapper;
import com.admin.mapper.NodeMapper;
import com.admin.mapper.TunnelMapper;
import com.admin.mapper.UserMapper;
import com.admin.service.ForwardService;
import com.admin.service.InboundService;
import com.admin.service.TunnelService;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 协议入站服务实现(合体面板:协议 + 限速)。
 * 架构:客户端 → gost(公网口:限速/流量/到期) → 127.0.0.1:sing-box入站(协议) → 外网。
 *
 * @author QAQ
 * @since 2026-07-19
 */
@Service
public class InboundServiceImpl extends ServiceImpl<InboundMapper, Inbound> implements InboundService {

    private static final int TUNNEL_TYPE_PORT_FORWARD = 1;
    private static final int SINGBOX_LISTEN_BASE = 40000;

    @Autowired
    private InboundUserMapper inboundUserMapper;
    @Autowired
    private NodeMapper nodeMapper;
    @Autowired
    private TunnelMapper tunnelMapper;
    @Autowired
    private TunnelService tunnelService;
    @Autowired
    private ForwardService forwardService;
    @Autowired
    private ForwardMapper forwardMapper;
    @Autowired
    private UserMapper userMapper;

    @Override
    public R createInbound(InboundDto dto) {
        Node node = nodeMapper.selectById(dto.getNodeId());
        if (node == null) {
            return R.err("节点不存在");
        }
        String protocol = (dto.getProtocol() == null || dto.getProtocol().isEmpty())
                ? "shadowsocks" : dto.getProtocol().toLowerCase();

        // 通用字段(sing-box 一律 listen 127.0.0.1,公网口交给 gost 限速)
        Inbound in = new Inbound();
        in.setNodeId(node.getId());
        in.setProtocol(protocol);
        in.setListenPort(dto.getListenPort() != null ? dto.getListenPort() : allocateListenPort(node.getId()));
        in.setTag("in-" + node.getId() + "-" + in.getListenPort());
        in.setRemark(dto.getRemark());
        in.setStatus(1);
        in.setCreatedTime(System.currentTimeMillis());
        in.setUpdatedTime(System.currentTimeMillis());

        // 按协议装配私有字段
        if ("shadowsocks".equals(protocol)) {
            // SS-2022:无 TLS、不依赖客户端指纹,绕开 reality 的后量子坑;单密码,用户靠 gost 口区分
            in.setSecurity("none");
            JSONObject cfg = new JSONObject();
            cfg.put("method", "2022-blake3-aes-256-gcm");
            cfg.put("password", genSsKey());
            in.setConfigJson(cfg.toJSONString());
        } else if ("vmess".equals(protocol)) {
            // VMess(TCP,无 TLS,无域名):无需密钥,用户 assign 时发 uuid
            in.setSecurity("none");
        } else if ("hysteria2".equals(protocol) || "tuic".equals(protocol) || "anytls".equals(protocol)) {
            // 自签 TLS(Hy2/TUIC 走 QUIC/UDP,AnyTLS 走 TCP;客户端 insecure);证书由节点端自动生成
            in.setSecurity("tls");
            in.setSni((dto.getSni() != null && !dto.getSni().isEmpty()) ? dto.getSni() : "www.bing.com");
        } else if ("vless".equals(protocol) || "trojan".equals(protocol)) {
            // VLESS / Trojan 均走 Reality(无域名):节点用 sing-box 生成 Reality 密钥对
            if (dto.getSni() == null || dto.getSni().isEmpty()) {
                return R.err("Reality 协议需要 SNI");
            }
            GostDto kp = SingboxUtil.GenerateRealityKeypair(node.getId(), null);
            // send_msg 返回的 GostDto 不设 code,判成功看 msg=="OK"(与 ForwardServiceImpl 一致)
            if (kp == null || !"OK".equals(kp.getMsg()) || kp.getData() == null) {
                return R.err("生成 Reality 密钥失败:" + (kp != null && kp.getMsg() != null ? kp.getMsg() : "节点无响应/超时"));
            }
            JSONObject kpData = JSON.parseObject(JSON.toJSONString(kp.getData()));
            String privateKey = kpData.getString("privateKey");
            String publicKey = kpData.getString("publicKey");
            if (privateKey == null || publicKey == null) {
                return R.err("Reality 密钥解析失败");
            }
            in.setSecurity("reality");
            in.setSni(dto.getSni());
            in.setDest((dto.getDest() != null && !dto.getDest().isEmpty()) ? dto.getDest() : dto.getSni());
            in.setPublicKey(publicKey);
            in.setPrivateKey(privateKey);
            in.setShortId(randomShortId());
        } else {
            return R.err("暂不支持的协议:" + protocol);
        }

        if (!this.save(in)) {
            return R.err("入站保存失败");
        }

        // 推该节点 sing-box 配置(此时可能还没用户,空 users 也能起)
        R push = pushNodeSingbox(node.getId());
        if (push.getCode() != 0) {
            this.removeById(in.getId());
            return push;
        }
        return R.ok(in);
    }

    @Override
    public R oneClickCreate(Long nodeId) {
        Node node = nodeMapper.selectById(nodeId);
        if (node == null) {
            return R.err("节点不存在");
        }
        // 支持的协议一键全建(reality 类默认借 www.apple.com)
        String[] protocols = {"vless", "trojan", "vmess", "shadowsocks", "hysteria2", "tuic", "anytls"};
        List<Object> created = new java.util.ArrayList<>();
        for (String p : protocols) {
            InboundDto dto = new InboundDto();
            dto.setNodeId(nodeId);
            dto.setProtocol(p);
            if ("vless".equals(p) || "trojan".equals(p)) {
                dto.setSni("www.apple.com");
            }
            R r = createInbound(dto);
            if (r.getCode() != 0) {
                return R.err("一键添加中断(" + p + "):" + r.getMsg() + "(已成功 " + created.size() + " 个)");
            }
            created.add(r.getData());
        }
        return R.ok(created);
    }

    @Override
    public R deleteInboundsByNode(Long nodeId) {
        List<Inbound> inbounds = this.list(new QueryWrapper<Inbound>().eq("node_id", nodeId));
        for (Inbound in : inbounds) {
            deleteInbound(in.getId());
        }
        return R.ok();
    }

    /** SS-2022 密钥:32 字节随机 → 标准 base64(带 padding),sing-box 的 password 要这个格式 */
    private String genSsKey() {
        byte[] b = new byte[32];
        new java.security.SecureRandom().nextBytes(b);
        return java.util.Base64.getEncoder().encodeToString(b);
    }

    @Override
    public R getInbounds() {
        return R.ok(this.list());
    }

    @Override
    public R deleteInbound(Long id) {
        Inbound in = this.getById(id);
        if (in == null) {
            return R.err("入站不存在");
        }
        List<InboundUser> users = inboundUserMapper.selectList(
                new QueryWrapper<InboundUser>().eq("inbound_id", id));
        for (InboundUser u : users) {
            if (u.getGostForwardId() != null) {
                forwardService.deleteForward(u.getGostForwardId());
            }
            inboundUserMapper.deleteById(u.getId());
        }
        this.removeById(id);
        pushNodeSingbox(in.getNodeId());
        return R.ok();
    }

    @Override
    public R assignUser(InboundUserDto dto) {
        Inbound in = this.getById(dto.getInboundId());
        if (in == null) {
            return R.err("入站不存在");
        }
        User user = userMapper.selectById(dto.getUserId());
        if (user == null) {
            return R.err("用户不存在");
        }
        Node node = nodeMapper.selectById(in.getNodeId());
        if (node == null) {
            return R.err("节点不存在");
        }

        // 1. 确保该节点有一条端口转发隧道(入口机=该节点)
        Tunnel tunnel = ensurePortForwardTunnel(node.getId());
        if (tunnel == null) {
            return R.err("创建入站转发隧道失败");
        }

        // 2. 生成凭证(uuid 给 vless/vmess,password 给 trojan)
        String uuid = UUID.randomUUID().toString();
        String password = UUID.randomUUID().toString().replace("-", "");

        // 3. 建该用户的 gost 前置转发(远程=127.0.0.1:入站口,绑限速/到期,归属车友)
        ForwardDto fdto = new ForwardDto();
        fdto.setName("inbound-" + in.getId() + "-user-" + user.getId());
        fdto.setTunnelId(tunnel.getId().intValue());
        fdto.setInPort(allocateHybridPort(node.getId())); // 高段公网口(20000+),避开被占的低端口
        fdto.setRemoteAddr("127.0.0.1:" + in.getListenPort());
        fdto.setStrategy("fifo");
        fdto.setSpeedId(dto.getSpeedId());
        fdto.setExpTime(dto.getExpTime());
        R fr = forwardService.createForwardForUser(fdto, user.getId().intValue(), user.getUser());
        if (fr.getCode() != 0 || fr.getData() == null) {
            return R.err("建转发失败:" + fr.getMsg());
        }
        Forward forward = (Forward) fr.getData();

        // 4. 流量配额写到用户(可空=不改)
        if (dto.getFlow() != null) {
            user.setFlow(dto.getFlow());
            userMapper.updateById(user);
        }

        // 5. 存 inbound_user
        InboundUser iu = new InboundUser();
        iu.setInboundId(in.getId());
        iu.setUserId(user.getId());
        iu.setUuid(uuid);
        iu.setPassword(password);
        iu.setGostForwardId(forward.getId());
        iu.setStatus(1);
        iu.setCreatedTime(System.currentTimeMillis());
        inboundUserMapper.insert(iu);

        // 6. 重推 sing-box 配置(users 里加上这个 uuid)
        R push = pushNodeSingbox(node.getId());
        if (push.getCode() != 0) {
            return push;
        }

        // 7. 出客户端链接(地址=该转发的公网口,被限速)
        String remark = (in.getRemark() != null && !in.getRemark().isEmpty()) ? in.getRemark() : in.getTag();
        String link;
        switch (in.getProtocol()) {
            case "shadowsocks": {
                JSONObject cfg = JSON.parseObject(in.getConfigJson() == null ? "{}" : in.getConfigJson());
                link = SingboxUtil.buildShadowsocksLink(node.getServerIp(), forward.getInPort(),
                        cfg.getString("method"), cfg.getString("password"), remark);
                break;
            }
            case "vmess":
                link = SingboxUtil.buildVmessLink(uuid, node.getServerIp(), forward.getInPort(), remark);
                break;
            case "trojan":
                link = SingboxUtil.buildTrojanRealityLink(password, node.getServerIp(), forward.getInPort(),
                        in.getSni(), in.getPublicKey(), in.getShortId(), remark);
                break;
            case "hysteria2":
                link = SingboxUtil.buildHysteria2Link(password, node.getServerIp(), forward.getInPort(), in.getSni(), remark);
                break;
            case "tuic":
                link = SingboxUtil.buildTuicLink(uuid, password, node.getServerIp(), forward.getInPort(), in.getSni(), remark);
                break;
            case "anytls":
                link = SingboxUtil.buildAnyTlsLink(password, node.getServerIp(), forward.getInPort(), in.getSni(), remark);
                break;
            default: // vless
                link = SingboxUtil.buildVlessRealityLink(uuid, node.getServerIp(), forward.getInPort(),
                        in.getSni(), in.getPublicKey(), in.getShortId(), remark);
        }

        JSONObject result = new JSONObject();
        result.put("inboundUserId", iu.getId());
        result.put("uuid", uuid);
        result.put("port", forward.getInPort());
        result.put("link", link);
        return R.ok(result);
    }

    @Override
    public R unassignUser(Long inboundUserId) {
        InboundUser iu = inboundUserMapper.selectById(inboundUserId);
        if (iu == null) {
            return R.err("记录不存在");
        }
        if (iu.getGostForwardId() != null) {
            forwardService.deleteForward(iu.getGostForwardId());
        }
        inboundUserMapper.deleteById(inboundUserId);
        Inbound in = this.getById(iu.getInboundId());
        if (in != null) {
            pushNodeSingbox(in.getNodeId());
        }
        return R.ok();
    }

    // -------- helpers --------

    /** 汇总该节点所有入站 + 各入站用户,推 sing-box 配置到节点 */
    private R pushNodeSingbox(Long nodeId) {
        List<Inbound> inbounds = this.list(new QueryWrapper<Inbound>().eq("node_id", nodeId));
        Map<Long, List<InboundUser>> usersByInbound = new HashMap<>();
        for (Inbound in : inbounds) {
            usersByInbound.put(in.getId(),
                    inboundUserMapper.selectList(new QueryWrapper<InboundUser>().eq("inbound_id", in.getId())));
        }
        GostDto r = SingboxUtil.SetSingboxConfig(nodeId, inbounds, usersByInbound, null);
        if (r == null || !"OK".equals(r.getMsg())) {
            return R.err("下发 sing-box 配置失败:" + (r != null && r.getMsg() != null ? r.getMsg() : "节点无响应/超时"));
        }
        return R.ok();
    }

    /** 给 hybrid 转发分配高段公网口(20000-39999),避开被占的低端口 + sing-box 段(40000+) */
    private Integer allocateHybridPort(Long nodeId) {
        java.util.Set<Integer> used = new java.util.HashSet<>();
        List<Tunnel> tunnels = tunnelMapper.selectList(new QueryWrapper<Tunnel>().eq("in_node_id", nodeId));
        if (tunnels != null && !tunnels.isEmpty()) {
            java.util.List<Long> tids = new java.util.ArrayList<>();
            for (Tunnel t : tunnels) {
                tids.add(t.getId());
            }
            List<Forward> fs = forwardMapper.selectList(new QueryWrapper<Forward>().in("tunnel_id", tids));
            for (Forward f : fs) {
                if (f.getInPort() != null) {
                    used.add(f.getInPort());
                }
            }
        }
        for (int p = 20000; p <= 39999; p++) {
            if (!used.contains(p)) {
                return p;
            }
        }
        return null;
    }

    /** 确保节点有一条端口转发隧道(入口机=该节点),没有则建 */
    private Tunnel ensurePortForwardTunnel(Long nodeId) {
        Tunnel tunnel = tunnelMapper.selectOne(new QueryWrapper<Tunnel>()
                .eq("in_node_id", nodeId).eq("type", TUNNEL_TYPE_PORT_FORWARD).last("limit 1"));
        if (tunnel != null) {
            return tunnel;
        }
        TunnelDto tdto = new TunnelDto();
        tdto.setName("inbound-tunnel-node" + nodeId);
        tdto.setInNodeId(nodeId);
        tdto.setType(TUNNEL_TYPE_PORT_FORWARD);
        tdto.setFlow(1);
        tdto.setTrafficRatio(BigDecimal.ONE);
        tdto.setProtocol("tls");
        R r = tunnelService.createTunnel(tdto);
        if (r.getCode() != 0) {
            return null;
        }
        return tunnelMapper.selectOne(new QueryWrapper<Tunnel>()
                .eq("in_node_id", nodeId).eq("type", TUNNEL_TYPE_PORT_FORWARD).last("limit 1"));
    }

    /** 分配 sing-box 本机监听口(40000+,避开 gost 公网口段) */
    private Integer allocateListenPort(Long nodeId) {
        List<Inbound> inbounds = this.list(new QueryWrapper<Inbound>().eq("node_id", nodeId));
        int max = SINGBOX_LISTEN_BASE - 1;
        for (Inbound in : inbounds) {
            if (in.getListenPort() != null && in.getListenPort() > max) {
                max = in.getListenPort();
            }
        }
        return max + 1;
    }

    /** 随机 8 位十六进制 shortId */
    private String randomShortId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }
}
