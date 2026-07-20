package com.admin.common.utils;

import com.admin.common.dto.GostDto;
import com.admin.entity.Inbound;
import com.admin.entity.InboundUser;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;

import java.util.List;
import java.util.Map;

/**
 * sing-box 配置生成 + 下发(合体面板 · 协议侧)。
 * 与 GostUtil 对称:GostUtil 管转发/限速的下发,SingboxUtil 管协议的下发。
 * 节点端 x/socket/singbox.go 收到 SetSingboxConfig 后写文件 + systemd 起 sing-box。
 * 约束:入站一律 listen 127.0.0.1,公网口交给 gost 转发并限速。
 */
public class SingboxUtil {

    /**
     * 生成某节点的完整 sing-box 配置(汇总该节点上所有入站),并通过 WebSocket 下发。
     *
     * @param nodeId          节点ID
     * @param inbounds        该节点上的入站列表
     * @param usersByInbound  入站ID -> 该入站下的用户凭证列表
     * @param mirror          国内 GitHub 镜像前缀(如 https://ghfast.top/),可为 null
     */
    public static GostDto SetSingboxConfig(Long nodeId, List<Inbound> inbounds,
                                           Map<Long, List<InboundUser>> usersByInbound, String mirror) {
        JSONObject payload = new JSONObject();
        payload.put("config", buildNodeConfig(inbounds, usersByInbound));
        if (mirror != null && !mirror.isEmpty()) {
            payload.put("mirror", mirror);
        }
        return WebSocketServer.send_msg(nodeId, payload, "SetSingboxConfig");
    }

    /** 关掉某节点的 sing-box */
    public static GostDto DeleteSingbox(Long nodeId) {
        return WebSocketServer.send_msg(nodeId, new JSONObject(), "DeleteSingbox");
    }

    /**
     * 让节点用 sing-box 生成 Reality 密钥对。
     * 返回的 GostDto.data = {"privateKey": "...", "publicKey": "..."}(节点端 handleGenerateRealityKeypair)。
     */
    public static GostDto GenerateRealityKeypair(Long nodeId, String mirror) {
        JSONObject payload = new JSONObject();
        if (mirror != null && !mirror.isEmpty()) {
            payload.put("mirror", mirror);
        }
        return WebSocketServer.send_msg(nodeId, payload, "GenerateRealityKeypair");
    }

    /**
     * 生成 VLESS-Reality 客户端分享链接。
     * 地址填的是该用户的【gost 公网端口】(被限速/计流量/到期),不是 sing-box 本机口。
     */
    public static String buildVlessRealityLink(String uuid, String serverIp, Integer port,
                                               String sni, String publicKey, String shortId, String remark) {
        String frag;
        try {
            frag = java.net.URLEncoder.encode(remark == null ? "" : remark, "UTF-8");
        } catch (Exception e) {
            frag = "";
        }
        return "vless://" + uuid + "@" + serverIp + ":" + port
                + "?encryption=none&flow=xtls-rprx-vision&security=reality"
                + "&sni=" + (sni == null ? "" : sni)
                + "&fp=chrome"
                + "&pbk=" + (publicKey == null ? "" : publicKey)
                + "&sid=" + (shortId == null ? "" : shortId)
                + "&type=tcp#" + frag;
    }

    /** 汇总一个节点的完整 sing-box 配置(log + 所有入站 + direct 出站) */
    public static JSONObject buildNodeConfig(List<Inbound> inbounds, Map<Long, List<InboundUser>> usersByInbound) {
        JSONObject log = new JSONObject();
        log.put("level", "warn");

        JSONArray inboundArr = new JSONArray();
        if (inbounds != null) {
            for (Inbound in : inbounds) {
                if (in.getStatus() != null && in.getStatus() == 0) {
                    continue; // 停用的入站不下发
                }
                List<InboundUser> users = usersByInbound != null ? usersByInbound.get(in.getId()) : null;
                JSONObject inboundJson = buildInbound(in, users);
                if (inboundJson != null) {
                    inboundArr.add(inboundJson);
                }
            }
        }

        JSONArray outbounds = new JSONArray();
        JSONObject direct = new JSONObject();
        direct.put("type", "direct");
        direct.put("tag", "direct");
        outbounds.add(direct);

        JSONObject config = new JSONObject();
        config.put("log", log);
        config.put("inbounds", inboundArr);
        config.put("outbounds", outbounds);
        return config;
    }

    /** 按协议生成单个 sing-box 入站(阶段1 只做 vless-reality) */
    public static JSONObject buildInbound(Inbound in, List<InboundUser> users) {
        String protocol = in.getProtocol() == null ? "" : in.getProtocol().toLowerCase();
        switch (protocol) {
            case "vless":
                return buildVlessReality(in, users);
            // 阶段2 再补 trojan / vmess / hysteria2
            default:
                return null;
        }
    }

    /** VLESS + Reality 入站(无域名);listen 一律 127.0.0.1,公网口交给 gost 限速 */
    private static JSONObject buildVlessReality(Inbound in, List<InboundUser> users) {
        JSONObject inbound = new JSONObject();
        inbound.put("type", "vless");
        inbound.put("tag", in.getTag());
        inbound.put("listen", "127.0.0.1");
        inbound.put("listen_port", in.getListenPort());

        JSONArray userArr = new JSONArray();
        if (users != null) {
            for (InboundUser u : users) {
                if (u.getUuid() == null || u.getUuid().isEmpty()) {
                    continue;
                }
                if (u.getStatus() != null && u.getStatus() == 0) {
                    continue;
                }
                JSONObject uj = new JSONObject();
                uj.put("uuid", u.getUuid());
                uj.put("flow", "xtls-rprx-vision");
                userArr.add(uj);
            }
        }
        inbound.put("users", userArr);

        // Reality over TLS
        JSONObject handshake = new JSONObject();
        handshake.put("server", in.getDest());
        handshake.put("server_port", 443);

        JSONArray shortIds = new JSONArray();
        shortIds.add(in.getShortId() == null ? "" : in.getShortId());

        JSONObject reality = new JSONObject();
        reality.put("enabled", true);
        reality.put("handshake", handshake);
        reality.put("private_key", in.getPrivateKey());
        reality.put("short_id", shortIds);

        JSONObject tls = new JSONObject();
        tls.put("enabled", true);
        tls.put("server_name", in.getSni());
        tls.put("reality", reality);
        inbound.put("tls", tls);

        return inbound;
    }
}
