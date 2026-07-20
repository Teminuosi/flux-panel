package socket

// 合体面板(协议+限速)· 节点端 sing-box 管理模块
// 面板通过 WebSocket 下发 SetSingboxConfig 命令,节点负责:
//   1) 确保 sing-box 外部二进制已安装(没有则下载 v1.13.12,和 s-ui 同版);
//   2) 写入面板生成的完整 sing-box 配置 JSON;
//   3) 用 systemd 起/热重启 sing-box(自带崩溃重启,和 gost 同套路)。
// sing-box 只在 127.0.0.1 监听,公网口由 gost 转发占用并限速(见 flux合体面板设计.md)。

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

const (
	installDir        = "/etc/gost" // 与 install.sh 的 INSTALL_DIR 一致,systemd WorkingDirectory 也是这
	singboxVersion    = "1.13.12"   // 与 s-ui 内嵌的 sing-box 版本对齐,配置格式兼容
	singboxServiceUnit = "/etc/systemd/system/sing-box.service"
)

// 串行化配置写入 + 重载,避免并发下发时打架
var singboxMu sync.Mutex

// SetSingboxConfig 命令下发的数据:面板给完整 sing-box 配置 + 可选国内下载镜像
type singboxConfigRequest struct {
	Config json.RawMessage `json:"config"`           // 完整 sing-box 配置(log/inbounds/outbounds…)
	Mirror string          `json:"mirror,omitempty"` // 国内 GitHub 镜像前缀(如 https://ghfast.top/),可空
}

func singboxBinPath() string    { return filepath.Join(installDir, "sing-box") }
func singboxConfigPath() string { return filepath.Join(installDir, "sing-box.json") }

// ---- 命令处理(在 routeCommand 里被调用)----

func (w *WebSocketReporter) handleSetSingboxConfig(data interface{}) error {
	singboxMu.Lock()
	defer singboxMu.Unlock()

	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("序列化 sing-box 配置失败: %v", err)
	}
	var req singboxConfigRequest
	if err := json.Unmarshal(jsonData, &req); err != nil {
		return fmt.Errorf("解析 sing-box 配置失败: %v", err)
	}
	if len(req.Config) == 0 {
		return fmt.Errorf("sing-box 配置为空")
	}

	if err := ensureSingboxInstalled(req.Mirror); err != nil {
		return err
	}
	if err := writeSingboxConfig(req.Config); err != nil {
		return err
	}
	if err := reloadSingbox(); err != nil {
		return err
	}
	return nil
}

func (w *WebSocketReporter) handleDeleteSingbox(data interface{}) error {
	singboxMu.Lock()
	defer singboxMu.Unlock()
	return stopSingbox()
}

// handleGenerateRealityKeypair 用 sing-box 生成 Reality 密钥对(比在后端手搓 x25519 可靠)
// 返回 {"privateKey": "...", "publicKey": "..."},面板存起来:私钥入服务端配置、公钥进客户端链接。
func (w *WebSocketReporter) handleGenerateRealityKeypair(data interface{}) (map[string]string, error) {
	fmt.Println("🔑 [reality] 收到,等 singboxMu 锁...")
	singboxMu.Lock()
	defer singboxMu.Unlock()
	fmt.Println("🔑 [reality] 已拿锁,检查 sing-box 是否就绪...")

	// 请求可带 mirror,用于首次下载 sing-box 二进制
	var req struct {
		Mirror string `json:"mirror,omitempty"`
	}
	if data != nil {
		if b, err := json.Marshal(data); err == nil {
			_ = json.Unmarshal(b, &req)
		}
	}
	if err := ensureSingboxInstalled(req.Mirror); err != nil {
		fmt.Printf("🔑 [reality] ensureSingboxInstalled 失败: %v\n", err)
		return nil, err
	}
	fmt.Println("🔑 [reality] sing-box 就绪, exec generate reality-keypair...")

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, singboxBinPath(), "generate", "reality-keypair").CombinedOutput()
	fmt.Printf("🔑 [reality] exec 返回 err=%v out=%q\n", err, string(out))
	if err != nil {
		return nil, fmt.Errorf("生成 reality 密钥失败: %v, %s", err, string(out))
	}
	priv, pub := parseRealityKeypair(string(out))
	if priv == "" || pub == "" {
		return nil, fmt.Errorf("解析 reality 密钥失败: %s", string(out))
	}
	fmt.Printf("🔑 [reality] 成功,priv=%d pub=%d 字符\n", len(priv), len(pub))
	return map[string]string{"privateKey": priv, "publicKey": pub}, nil
}

// parseRealityKeypair 解析 `sing-box generate reality-keypair` 的输出:
//   PrivateKey: xxxx
//   PublicKey: yyyy
func parseRealityKeypair(out string) (priv, pub string) {
	for _, line := range strings.Split(out, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "PrivateKey:") {
			priv = strings.TrimSpace(strings.TrimPrefix(line, "PrivateKey:"))
		} else if strings.HasPrefix(line, "PublicKey:") {
			pub = strings.TrimSpace(strings.TrimPrefix(line, "PublicKey:"))
		}
	}
	return priv, pub
}

// ---- 安装 / 配置 / 服务管理 ----

// ensureSingboxInstalled 二进制不存在则下载指定版本并解压
func ensureSingboxInstalled(mirror string) error {
	bin := singboxBinPath()
	if fi, err := os.Stat(bin); err == nil && fi.Size() > 0 {
		return nil
	}

	arch := runtime.GOARCH // amd64 / arm64
	asset := fmt.Sprintf("sing-box-%s-linux-%s.tar.gz", singboxVersion, arch)
	url := fmt.Sprintf("https://github.com/SagerNet/sing-box/releases/download/v%s/%s", singboxVersion, asset)
	if mirror != "" {
		url = mirror + url
	}

	tmp := filepath.Join(installDir, "sing-box.tar.gz")
	if err := downloadFile(url, tmp); err != nil {
		return fmt.Errorf("下载 sing-box 失败(%s): %v", url, err)
	}
	defer os.Remove(tmp)

	if err := extractSingboxBinary(tmp, bin); err != nil {
		return fmt.Errorf("解压 sing-box 失败: %v", err)
	}
	if err := os.Chmod(bin, 0o755); err != nil {
		return fmt.Errorf("给 sing-box 加执行权限失败: %v", err)
	}
	return nil
}

func writeSingboxConfig(cfg json.RawMessage) error {
	if err := os.WriteFile(singboxConfigPath(), cfg, 0o600); err != nil {
		return fmt.Errorf("写 sing-box.json 失败: %v", err)
	}
	return nil
}

// reloadSingbox 确保 systemd 服务存在并(热)重启 sing-box
func reloadSingbox() error {
	if err := ensureSingboxService(); err != nil {
		return err
	}
	_ = exec.Command("systemctl", "enable", "sing-box").Run()
	if out, err := exec.Command("systemctl", "restart", "sing-box").CombinedOutput(); err != nil {
		return fmt.Errorf("重启 sing-box 失败: %v, %s", err, string(out))
	}
	return nil
}

func stopSingbox() error {
	_ = exec.Command("systemctl", "stop", "sing-box").Run()
	_ = exec.Command("systemctl", "disable", "sing-box").Run()
	return nil
}

// ensureSingboxService 写入/更新 systemd 单元(带 Restart=on-failure 自愈)
func ensureSingboxService() error {
	unit := fmt.Sprintf(`[Unit]
Description=sing-box (flux hybrid)
After=network.target

[Service]
WorkingDirectory=%s
ExecStart=%s run -c %s
Restart=on-failure
RestartSec=3
LimitNOFILE=1048576

[Install]
WantedBy=multi-user.target
`, installDir, singboxBinPath(), singboxConfigPath())

	if existing, err := os.ReadFile(singboxServiceUnit); err == nil && string(existing) == unit {
		return nil // 已是最新,无需 daemon-reload
	}
	if err := os.WriteFile(singboxServiceUnit, []byte(unit), 0o644); err != nil {
		return fmt.Errorf("写 sing-box.service 失败: %v", err)
	}
	if out, err := exec.Command("systemctl", "daemon-reload").CombinedOutput(); err != nil {
		return fmt.Errorf("systemctl daemon-reload 失败: %v, %s", err, string(out))
	}
	return nil
}

// ---- 下载 / 解压工具 ----

func downloadFile(url, dest string) error {
	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer out.Close()
	if _, err := io.Copy(out, resp.Body); err != nil {
		return err
	}
	return nil
}

// extractSingboxBinary 从 sing-box release 的 tar.gz 里抽出 sing-box 二进制
// 归档结构形如 sing-box-1.13.12-linux-amd64/sing-box
func extractSingboxBinary(tarGzPath, dest string) error {
	f, err := os.Open(tarGzPath)
	if err != nil {
		return err
	}
	defer f.Close()

	gz, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gz.Close()

	tr := tar.NewReader(gz)
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		if hdr.Typeflag == tar.TypeReg && filepath.Base(hdr.Name) == "sing-box" {
			out, err := os.Create(dest)
			if err != nil {
				return err
			}
			defer out.Close()
			if _, err := io.Copy(out, tr); err != nil {
				return err
			}
			return nil
		}
	}
	return fmt.Errorf("归档里没找到 sing-box 二进制")
}
