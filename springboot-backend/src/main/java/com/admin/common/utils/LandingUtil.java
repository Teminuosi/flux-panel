package com.admin.common.utils;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * 把一条节点分享链接解析成 sing-box 出站(outbound)。
 * 支持:socks5:// / ss:// / vmess:// / vless:// / trojan:// / hysteria2://(hy2://)。
 *
 * 解析结果不含 "tag";下发节点配置时由 SingboxUtil 填 "landing-<id>",这样一条落地能被多台前置机复用。
 * 落地多为任意第三方节点(住宅代理 / 机场),TLS 一律 insecure=true(不校验证书),reality 除外(用 pbk 校验)。
 */
public class LandingUtil {

    /** 解析结果:type=协议类型(存 landing.type),outbound=sing-box 出站(不含 tag) */
    public static class Parsed {
        public String type;
        public JSONObject outbound;
        public Parsed(String type, JSONObject outbound) {
            this.type = type;
            this.outbound = outbound;
        }
    }

    /** 解析一条分享链接;失败抛 IllegalArgumentException(带中文原因) */
    public static Parsed parse(String link) {
        if (link == null) {
            throw new IllegalArgumentException("链接为空");
        }
        String s = link.trim();
        String lower = s.toLowerCase();
        try {
            if (lower.startsWith("socks5://") || lower.startsWith("socks://") || lower.startsWith("socks4://")) {
                return new Parsed("socks5", parseSocks(s));
            }
            if (lower.startsWith("ss://")) {
                return new Parsed("shadowsocks", parseShadowsocks(s));
            }
            if (lower.startsWith("vmess://")) {
                return new Parsed("vmess", parseVmess(s));
            }
            if (lower.startsWith("vless://")) {
                return new Parsed("vless", parseVless(s));
            }
            if (lower.startsWith("trojan://")) {
                return new Parsed("trojan", parseTrojan(s));
            }
            if (lower.startsWith("hysteria2://") || lower.startsWith("hy2://")) {
                return new Parsed("hysteria2", parseHysteria2(s));
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("链接解析失败:" + e.getMessage());
        }
        throw new IllegalArgumentException("不支持的链接类型(支持 socks5/ss/vmess/vless/trojan/hysteria2)");
    }

    // ---------- socks5://[user:pass@]host:port ----------
    private static JSONObject parseSocks(String s) {
        String body = stripScheme(s);
        body = stripFragment(body);
        // 去掉可能的 query(?后)
        int q = body.indexOf('?');
        if (q >= 0) body = body.substring(0, q);

        String user = null, pass = null, hostPort;
        int at = body.lastIndexOf('@');
        if (at >= 0) {
            String userinfo = body.substring(0, at);
            hostPort = body.substring(at + 1);
            // userinfo 可能是明文 user:pass,也可能整体 base64
            if (userinfo.contains(":")) {
                String[] up = userinfo.split(":", 2);
                user = urlDecode(up[0]);
                pass = urlDecode(up[1]);
            } else {
                String dec = tryBase64(userinfo);
                if (dec != null && dec.contains(":")) {
                    String[] up = dec.split(":", 2);
                    user = up[0];
                    pass = up[1];
                } else {
                    user = urlDecode(userinfo);
                }
            }
        } else {
            hostPort = body;
        }
        String[] hp = splitHostPort(hostPort);
        JSONObject o = new JSONObject();
        o.put("type", "socks");
        o.put("server", hp[0]);
        o.put("server_port", Integer.parseInt(hp[1]));
        o.put("version", "5");
        if (user != null && !user.isEmpty()) {
            o.put("username", user);
            o.put("password", pass == null ? "" : pass);
        }
        return o;
    }

    // ---------- ss://  SIP002 或 legacy ----------
    private static JSONObject parseShadowsocks(String s) {
        String body = stripScheme(s);
        body = stripFragment(body);
        int q = body.indexOf('?');
        if (q >= 0) body = body.substring(0, q);

        String method, password, host, port;
        int at = body.lastIndexOf('@');
        if (at >= 0) {
            // SIP002: base64url(method:password)@host:port
            String userinfo = body.substring(0, at);
            String hostPort = body.substring(at + 1);
            String dec = tryBase64(userinfo);
            if (dec == null) dec = urlDecode(userinfo);
            String[] mp = dec.split(":", 2);
            method = mp[0];
            password = mp.length > 1 ? mp[1] : "";
            String[] hp = splitHostPort(hostPort);
            host = hp[0];
            port = hp[1];
        } else {
            // legacy: base64(method:password@host:port)
            String dec = tryBase64(body);
            if (dec == null) throw new IllegalArgumentException("ss 链接无法解码");
            int a2 = dec.lastIndexOf('@');
            String mp = dec.substring(0, a2);
            String[] m = mp.split(":", 2);
            method = m[0];
            password = m.length > 1 ? m[1] : "";
            String[] hp = splitHostPort(dec.substring(a2 + 1));
            host = hp[0];
            port = hp[1];
        }
        JSONObject o = new JSONObject();
        o.put("type", "shadowsocks");
        o.put("server", host);
        o.put("server_port", Integer.parseInt(port));
        o.put("method", method);
        o.put("password", password);
        return o;
    }

    // ---------- vmess://base64(json) ----------
    private static JSONObject parseVmess(String s) {
        String b = stripScheme(s);
        b = stripFragment(b);
        String dec = tryBase64(b);
        if (dec == null) throw new IllegalArgumentException("vmess 链接无法解码");
        JSONObject v = JSON.parseObject(dec);
        JSONObject o = new JSONObject();
        o.put("type", "vmess");
        o.put("server", v.getString("add"));
        o.put("server_port", toInt(v.getString("port"), 0));
        o.put("uuid", v.getString("id"));
        o.put("security", isBlank(v.getString("scy")) ? "auto" : v.getString("scy"));
        o.put("alter_id", toInt(v.getString("aid"), 0));
        String tls = v.getString("tls");
        String host = v.getString("host");
        String sni = v.getString("sni");
        if ("tls".equalsIgnoreCase(tls)) {
            o.put("tls", tlsBlock(isBlank(sni) ? (isBlank(host) ? v.getString("add") : host) : sni, null, null, null));
        }
        JSONObject tr = transport(v.getString("net"), v.getString("path"), host);
        if (tr != null) o.put("transport", tr);
        return o;
    }

    // ---------- vless://uuid@host:port?params#tag ----------
    private static JSONObject parseVless(String s) {
        String body = stripScheme(s);
        body = stripFragment(body);
        Map<String, String> q = new HashMap<>();
        int qi = body.indexOf('?');
        if (qi >= 0) {
            q = parseQuery(body.substring(qi + 1));
            body = body.substring(0, qi);
        }
        int at = body.lastIndexOf('@');
        String uuid = urlDecode(body.substring(0, at));
        String[] hp = splitHostPort(body.substring(at + 1));

        JSONObject o = new JSONObject();
        o.put("type", "vless");
        o.put("server", hp[0]);
        o.put("server_port", Integer.parseInt(hp[1]));
        o.put("uuid", uuid);
        String flow = q.get("flow");
        if (!isBlank(flow)) o.put("flow", flow);

        String security = q.getOrDefault("security", "none");
        String sni = firstNonBlank(q.get("sni"), q.get("peer"), hp[0]);
        String fp = firstNonBlank(q.get("fp"), "chrome");
        if ("reality".equalsIgnoreCase(security)) {
            o.put("tls", tlsBlock(sni, fp, q.get("pbk"), q.get("sid")));
        } else if ("tls".equalsIgnoreCase(security) || "xtls".equalsIgnoreCase(security)) {
            o.put("tls", tlsBlock(sni, fp, null, null));
        }
        JSONObject tr = transport(q.get("type"), firstNonBlank(q.get("path"), q.get("serviceName")), q.get("host"));
        if (tr != null) o.put("transport", tr);
        return o;
    }

    // ---------- trojan://password@host:port?params#tag ----------
    private static JSONObject parseTrojan(String s) {
        String body = stripScheme(s);
        body = stripFragment(body);
        Map<String, String> q = new HashMap<>();
        int qi = body.indexOf('?');
        if (qi >= 0) {
            q = parseQuery(body.substring(qi + 1));
            body = body.substring(0, qi);
        }
        int at = body.lastIndexOf('@');
        String password = urlDecode(body.substring(0, at));
        String[] hp = splitHostPort(body.substring(at + 1));

        JSONObject o = new JSONObject();
        o.put("type", "trojan");
        o.put("server", hp[0]);
        o.put("server_port", Integer.parseInt(hp[1]));
        o.put("password", password);
        String sni = firstNonBlank(q.get("sni"), q.get("peer"), hp[0]);
        o.put("tls", tlsBlock(sni, firstNonBlank(q.get("fp"), "chrome"), null, null));
        JSONObject tr = transport(q.get("type"), firstNonBlank(q.get("path"), q.get("serviceName")), q.get("host"));
        if (tr != null) o.put("transport", tr);
        return o;
    }

    // ---------- hysteria2://password@host:port?params#tag ----------
    private static JSONObject parseHysteria2(String s) {
        String body = stripScheme(s);
        body = stripFragment(body);
        Map<String, String> q = new HashMap<>();
        int qi = body.indexOf('?');
        if (qi >= 0) {
            q = parseQuery(body.substring(qi + 1));
            body = body.substring(0, qi);
        }
        int at = body.lastIndexOf('@');
        String password = urlDecode(body.substring(0, at));
        String[] hp = splitHostPort(body.substring(at + 1));

        JSONObject o = new JSONObject();
        o.put("type", "hysteria2");
        o.put("server", hp[0]);
        o.put("server_port", Integer.parseInt(hp[1]));
        o.put("password", password);
        String sni = firstNonBlank(q.get("sni"), q.get("peer"), hp[0]);
        o.put("tls", tlsBlock(sni, null, null, null));
        String obfs = q.get("obfs");
        if (!isBlank(obfs)) {
            JSONObject ob = new JSONObject();
            ob.put("type", obfs);
            ob.put("password", firstNonBlank(q.get("obfs-password"), q.get("obfsParam"), ""));
            o.put("obfs", ob);
        }
        return o;
    }

    // ---------- helpers ----------

    /** 生成 sing-box tls 块;pbk 非空 → reality(用公钥校验),否则普通 tls + insecure(落地是任意节点,不校验证书) */
    private static JSONObject tlsBlock(String sni, String fp, String pbk, String sid) {
        JSONObject tls = new JSONObject();
        tls.put("enabled", true);
        if (!isBlank(sni)) tls.put("server_name", sni);
        if (!isBlank(pbk)) {
            // reality:用 utls 指纹 + 公钥校验,不 insecure
            JSONObject utls = new JSONObject();
            utls.put("enabled", true);
            utls.put("fingerprint", isBlank(fp) ? "chrome" : fp);
            tls.put("utls", utls);
            JSONObject reality = new JSONObject();
            reality.put("enabled", true);
            reality.put("public_key", pbk);
            if (!isBlank(sid)) reality.put("short_id", sid);
            tls.put("reality", reality);
        } else {
            tls.put("insecure", true);
            if (!isBlank(fp)) {
                JSONObject utls = new JSONObject();
                utls.put("enabled", true);
                utls.put("fingerprint", fp);
                tls.put("utls", utls);
            }
        }
        return tls;
    }

    /** ws/grpc 传输;tcp/空 返回 null(默认 tcp,不写 transport) */
    private static JSONObject transport(String net, String path, String host) {
        if (isBlank(net)) return null;
        net = net.toLowerCase();
        if ("ws".equals(net)) {
            JSONObject t = new JSONObject();
            t.put("type", "ws");
            if (!isBlank(path)) t.put("path", path);
            if (!isBlank(host)) {
                JSONObject headers = new JSONObject();
                headers.put("Host", host);
                t.put("headers", headers);
            }
            return t;
        }
        if ("grpc".equals(net)) {
            JSONObject t = new JSONObject();
            t.put("type", "grpc");
            if (!isBlank(path)) t.put("service_name", path);
            return t;
        }
        if ("http".equals(net) || "h2".equals(net)) {
            JSONObject t = new JSONObject();
            t.put("type", "http");
            if (!isBlank(path)) t.put("path", path);
            if (!isBlank(host)) {
                com.alibaba.fastjson.JSONArray hosts = new com.alibaba.fastjson.JSONArray();
                hosts.add(host);
                t.put("host", hosts);
            }
            return t;
        }
        return null; // tcp / 其它:默认,不写
    }

    private static String stripScheme(String s) {
        int i = s.indexOf("://");
        return i >= 0 ? s.substring(i + 3) : s;
    }

    private static String stripFragment(String s) {
        int i = s.indexOf('#');
        return i >= 0 ? s.substring(0, i) : s;
    }

    private static String[] splitHostPort(String hp) {
        // 支持 [ipv6]:port
        if (hp.startsWith("[")) {
            int rb = hp.indexOf(']');
            String host = hp.substring(1, rb);
            String port = hp.substring(hp.indexOf(':', rb) + 1);
            return new String[]{host, port};
        }
        int c = hp.lastIndexOf(':');
        if (c < 0) throw new IllegalArgumentException("缺少端口:" + hp);
        return new String[]{hp.substring(0, c), hp.substring(c + 1)};
    }

    private static Map<String, String> parseQuery(String q) {
        Map<String, String> m = new HashMap<>();
        for (String kv : q.split("&")) {
            if (kv.isEmpty()) continue;
            int e = kv.indexOf('=');
            if (e < 0) {
                m.put(urlDecode(kv), "");
            } else {
                m.put(urlDecode(kv.substring(0, e)), urlDecode(kv.substring(e + 1)));
            }
        }
        return m;
    }

    /** 尝试 base64(标准/url,带或不带 padding)解码;不像 base64 返回 null */
    private static String tryBase64(String s) {
        if (s == null || s.isEmpty()) return null;
        String t = s.replace('-', '+').replace('_', '/').trim();
        int pad = t.length() % 4;
        if (pad != 0) {
            StringBuilder sb = new StringBuilder(t);
            for (int i = 0; i < 4 - pad; i++) sb.append('=');
            t = sb.toString();
        }
        try {
            byte[] b = Base64.getDecoder().decode(t);
            String out = new String(b, StandardCharsets.UTF_8);
            // 粗判:解出来应可打印(避免把普通字符串误当 base64)
            return out;
        } catch (Exception e) {
            return null;
        }
    }

    private static String urlDecode(String s) {
        try {
            return URLDecoder.decode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }

    private static int toInt(String s, int def) {
        try {
            return Integer.parseInt(s.trim());
        } catch (Exception e) {
            return def;
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String firstNonBlank(String... arr) {
        for (String a : arr) {
            if (!isBlank(a)) return a;
        }
        return null;
    }
}
