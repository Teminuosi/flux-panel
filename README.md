# flux-panel转发面板 哆啦A梦转发面板

## 项目更新说明
由于一些个人原因，**flux-panel** 将暂停更新一段时间，**恢复更新时间暂不确定**。

在此期间，项目不会继续推进新功能或修复问题，对可能带来的不便表示抱歉。当前已有功能仍可正常使用，也欢迎大家继续 Fork 或自行维护。

如后续恢复更新，我会第一时间在仓库中说明。  
感谢大家的理解与支持。


本项目基于 [go-gost/gost](https://github.com/go-gost/gost) 和 [go-gost/x](https://github.com/go-gost/x) 两个开源库，实现了转发面板。
---
## 特性

- 支持按 **隧道账号级别** 管理流量转发数量，可用于用户/隧道配额控制
- 支持 **TCP** 和 **UDP** 协议的转发
- 支持两种转发模式：**端口转发** 与 **隧道转发**
- 可针对 **指定用户的指定隧道进行限速** 设置
- 支持配置 **单向或双向流量计费方式**，灵活适配不同计费模型
- 提供灵活的转发策略配置，适用于多种网络场景


## 部署流程
---
### Docker Compose部署
#### 快速部署
只有两条命令。先在一台机器装**面板端**,再到每台转发机装**节点端**。

**面板端**(中央管理面板,一台即可,全自动;需要 Docker,脚本会自动装):
```bash
curl -L https://raw.githubusercontent.com/Teminuosi/flux-panel/main/panel_install.sh -o panel_install.sh && chmod +x panel_install.sh && ./panel_install.sh
```

**节点端**(转发节点,每台转发机都装;裸二进制,不需要 Docker):
```bash
curl -L https://raw.githubusercontent.com/Teminuosi/flux-panel/main/install.sh -o install.sh && chmod +x install.sh && ./install.sh
```

#### 默认管理员账号

- **账号**: admin_user
- **密码**: admin_user

> ⚠️ 首次登录后请立即修改默认密码！


## 免责声明

本项目仅供个人学习与研究使用，基于开源项目进行二次开发。  

使用本项目所带来的任何风险均由使用者自行承担，包括但不限于：  

- 配置不当或使用错误导致的服务异常或不可用；  
- 使用本项目引发的网络攻击、封禁、滥用等行为；  
- 服务器因使用本项目被入侵、渗透、滥用导致的数据泄露、资源消耗或损失；  
- 因违反当地法律法规所产生的任何法律责任。  

本项目为开源的流量转发工具，仅限合法、合规用途。  
使用者必须确保其使用行为符合所在国家或地区的法律法规。  

**作者不对因使用本项目导致的任何法律责任、经济损失或其他后果承担责任。**  
**禁止将本项目用于任何违法或未经授权的行为，包括但不限于网络攻击、数据窃取、非法访问等。**  

如不同意上述条款，请立即停止使用本项目。  

作者对因使用本项目所造成的任何直接或间接损失概不负责，亦不提供任何形式的担保、承诺或技术支持。  


请务必在合法、合规、安全的前提下使用本项目。  

---
## ⭐ 喝杯咖啡！（USDT）

| 网络       | 地址                                                                 |
|------------|----------------------------------------------------------------------|
| BNB(BEP20) | `0x755492c03728851bbf855daa28a1e089f9aca4d1`                          |
| TRC20      | `TYh2L3xxXpuJhAcBWnt3yiiADiCSJLgUm7`                                  |
| Aptos      | `0xf2f9fb14749457748506a8281628d556e8540d1eb586d202cd8b02b99d369ef8`  |

[![Star History Chart](https://api.star-history.com/svg?repos=Teminuosi/flux-panel&type=Date)](https://www.star-history.com/#Teminuosi/flux-panel&Date)

