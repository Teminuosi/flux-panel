import { useState, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import toast from "react-hot-toast";
import {
  getInboundList,
  createInbound,
  oneClickInbound,
  deleteInboundsByNode,
  assignAllToUser,
  getNodeList,
  getAllUsers,
  getSpeedLimitList,
} from "@/api";

/**
 * 协议管理(合体面板)· 机器卡模式。
 * 一台机器 = 一张卡(卡上折叠着这台机器的全套协议)。
 * 卡上「分配用户」→ 把这台机器所有协议一次分给车友 → 出一条订阅链接。
 * 车友加这一条订阅,机器上全部协议自动到手,以后加新协议自动更新。
 */
export default function InboundPage() {
  const [inbounds, setInbounds] = useState<any[]>([]);
  const [nodes, setNodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [speedRules, setSpeedRules] = useState<any[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<any>({ nodeId: null, protocol: "vless", sni: "www.apple.com", dest: "", remark: "" });
  const [createLoading, setCreateLoading] = useState(false);

  const [oneClickOpen, setOneClickOpen] = useState(false);
  const [oneClickNodeId, setOneClickNodeId] = useState<number | null>(null);
  const [oneClickLoading, setOneClickLoading] = useState(false);

  // 机器卡「分配用户」:把整台机器的协议分给车友(只分配,链接去「用户管理」拿)
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<any>({ nodeId: null, nodeName: "", protocolCount: 0, userId: null, speedId: null, expDays: null, flowGb: null });
  const [assignLoading, setAssignLoading] = useState(false);

  const loadAll = async () => {
    try {
      const [ib, nd, us, sp] = await Promise.all([
        getInboundList(),
        getNodeList(),
        getAllUsers(),
        getSpeedLimitList(),
      ]);
      if (ib.code === 0) setInbounds(ib.data || []);
      if (nd.code === 0) setNodes(nd.data || []);
      if (us.code === 0) {
        const d: any = us.data;
        setUsers(Array.isArray(d) ? d : (d && d.records ? d.records : []));
      }
      if (sp.code === 0) setSpeedRules(sp.data || []);
    } catch (e) {
      toast.error("加载失败");
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const protoLabel = (p: string) =>
    (({ vless: "VLESS-Reality", trojan: "Trojan-Reality", vmess: "VMess", shadowsocks: "Shadowsocks-2022", hysteria2: "Hysteria2", tuic: "TUIC", anytls: "AnyTLS" } as any)[p] || p);
  const isReality = (p: string) => p === "vless" || p === "trojan";

  const handleCreate = async () => {
    if (!createForm.nodeId) return toast.error("请选择节点");
    if (isReality(createForm.protocol) && !createForm.sni) return toast.error("Reality 协议需要填 SNI");
    setCreateLoading(true);
    try {
      const payload: any = {
        nodeId: createForm.nodeId,
        protocol: createForm.protocol,
        remark: createForm.remark,
      };
      if (isReality(createForm.protocol)) {
        payload.sni = createForm.sni;
        payload.dest = createForm.dest;
      }
      const res = await createInbound(payload);
      if (res.code === 0) {
        toast.success("入站已创建");
        setCreateOpen(false);
        loadAll();
      } else {
        toast.error(res.msg || "创建失败");
      }
    } catch (e) {
      toast.error("创建失败");
    }
    setCreateLoading(false);
  };

  const handleOneClick = async () => {
    if (!oneClickNodeId) return toast.error("请选择节点");
    setOneClickLoading(true);
    try {
      const res = await oneClickInbound(oneClickNodeId);
      if (res.code === 0) {
        toast.success("一键添加完成:整机全套协议已建好");
        setOneClickOpen(false);
        loadAll();
      } else {
        toast.error(res.msg || "一键添加失败");
      }
    } catch (e) {
      toast.error("一键添加失败");
    }
    setOneClickLoading(false);
  };

  const openNodeAssign = (n: any, count: number) => {
    setAssignForm({ nodeId: n.id, nodeName: n.name, protocolCount: count, userId: null, speedId: null, expDays: null, flowGb: null });
    setAssignOpen(true);
  };

  const handleNodeAssign = async () => {
    if (!assignForm.userId) return toast.error("请选择车友");
    setAssignLoading(true);
    try {
      const payload: any = { userId: assignForm.userId, nodeId: assignForm.nodeId };
      if (assignForm.speedId) payload.speedId = assignForm.speedId;
      if (assignForm.expDays) payload.expTime = Date.now() + assignForm.expDays * 86400000;
      if (assignForm.flowGb) payload.flow = Math.round(assignForm.flowGb * 1024 * 1024 * 1024);
      const res = await assignAllToUser(payload);
      if (res.code === 0) {
        toast.success(`已分配 ${res.data?.assigned ?? 0} 个协议` + (res.data?.skipped ? `,跳过 ${res.data.skipped}(已分过)` : "") + " · 订阅链接去「用户管理」拿");
        setAssignOpen(false);
        loadAll();
      } else {
        toast.error(res.msg || "分配失败");
      }
    } catch (e) {
      toast.error("分配失败");
    }
    setAssignLoading(false);
  };

  const handleClearNode = async (nodeId: number, nodeName: string) => {
    if (!window.confirm(`确定清空「${nodeName}」上的所有协议?(连带其转发/用户)`)) return;
    const res = await deleteInboundsByNode(nodeId);
    if (res.code === 0) {
      toast.success("已清空该机协议");
      loadAll();
    } else {
      toast.error(res.msg || "清空失败");
    }
  };

  const machineNodes = nodes.filter((n) => inbounds.some((ib) => ib.nodeId === n.id));

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">协议管理</h1>
        <div className="flex gap-2">
          <Button
            color="secondary"
            onPress={() => {
              setOneClickNodeId(null);
              setOneClickOpen(true);
            }}
          >
            ⚡ 一键搭建整机协议
          </Button>
          <Button
            color="primary"
            variant="flat"
            onPress={() => {
              setCreateForm({ nodeId: null, protocol: "vless", sni: "www.apple.com", dest: "", remark: "" });
              setCreateOpen(true);
            }}
          >
            单独加一个协议
          </Button>
        </div>
      </div>

      {/* 一机一卡:每台机器的全套协议折叠成一条记录,卡上直接分配用户 */}
      <div className="grid gap-3 md:grid-cols-2">
        {machineNodes.map((n) => {
          const nodeInbounds = inbounds.filter((ib) => ib.nodeId === n.id);
          const online = n.status === 1;
          const firstIp = n.ip ? String(n.ip).split(",")[0].trim() : (n.serverIp || "");
          return (
            <Card key={n.id}>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold truncate">🖥️ {n.name}</span>
                  <Chip size="sm" variant="flat" color={online ? "success" : "default"}>{online ? "在线" : "离线"}</Chip>
                  <Chip size="sm" variant="flat" color="primary" className="ml-auto">{nodeInbounds.length} 协议</Chip>
                </div>
                {firstIp && <div className="text-xs text-default-500 font-mono">{firstIp}</div>}
                <div className="flex flex-wrap gap-1">
                  {nodeInbounds.map((ib) => (
                    <Chip key={ib.id} size="sm" variant="flat" color="secondary">{protoLabel(ib.protocol)}</Chip>
                  ))}
                </div>
                <div className="text-xs text-default-400">
                  整机一条订阅:分配给车友后,一条订阅链接导入客户端即拿到上面全部协议,以后加新协议自动更新。
                </div>
                <div className="flex gap-2">
                  <Button size="sm" color="primary" className="flex-1" onPress={() => openNodeAssign(n, nodeInbounds.length)}>
                    👤 分配用户
                  </Button>
                  <Button size="sm" color="danger" variant="flat" onPress={() => handleClearNode(n.id, n.name)}>
                    清空该机
                  </Button>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
      {machineNodes.length === 0 && (
        <div className="text-center text-default-400 py-8">还没有协议,点右上角「⚡ 一键搭建整机协议」在某台机器上把全套协议建出来</div>
      )}

      {/* 机器卡「分配用户」:整机协议一次分给车友,出一条订阅链接 */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)}>
        <ModalContent>
          <ModalHeader>👤 给车友分配「{assignForm.nodeName}」</ModalHeader>
          <ModalBody className="space-y-3">
            <div className="text-sm text-default-500">
              把这台机器上的 <b>{assignForm.protocolCount} 个协议</b> 一次分给车友。分配完到「用户管理」页,点该车友的「🔗 订阅链接」拿链接发给他。
            </div>
            <Select
              label="子账号(车友)"
              placeholder="选一个车友"
              selectedKeys={assignForm.userId ? [String(assignForm.userId)] : []}
              onSelectionChange={(k) => setAssignForm({ ...assignForm, userId: Number(Array.from(k)[0]) })}
            >
              {users.map((u) => (<SelectItem key={u.id}>{u.user}</SelectItem>))}
            </Select>
            <Select
              label="限速规则(可空)"
              placeholder="不限速"
              selectedKeys={assignForm.speedId ? [String(assignForm.speedId)] : []}
              onSelectionChange={(k) => setAssignForm({ ...assignForm, speedId: Number(Array.from(k)[0]) })}
            >
              {speedRules.map((s) => (<SelectItem key={s.id}>{s.name}</SelectItem>))}
            </Select>
            <Input
              type="number"
              label="到期(天,留空=永久)"
              value={assignForm.expDays ?? ""}
              onChange={(e) => setAssignForm({ ...assignForm, expDays: e.target.value ? Number(e.target.value) : null })}
            />
            <Input
              type="number"
              label="流量配额(GB,留空=不限)"
              value={assignForm.flowGb ?? ""}
              onChange={(e) => setAssignForm({ ...assignForm, flowGb: e.target.value ? Number(e.target.value) : null })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setAssignOpen(false)}>关闭</Button>
            <Button color="primary" isLoading={assignLoading} onPress={handleNodeAssign}>分配</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 一键搭建整机协议:选机器,把所有支持的协议一键全建出来 */}
      <Modal isOpen={oneClickOpen} onClose={() => setOneClickOpen(false)}>
        <ModalContent>
          <ModalHeader>⚡ 一键搭建整机协议</ModalHeader>
          <ModalBody className="space-y-3">
            <div className="text-sm text-default-500">
              在选中的机器上一键建好全部协议:<b>VLESS-Reality、Trojan-Reality、VMess、Hysteria2、TUIC、AnyTLS</b>(端口、密钥、自签证书全自动;端口被占自动上移)。建好后就是一张机器卡,点「分配用户」出订阅即可。
            </div>
            <Select
              label="机器"
              placeholder="选一台机器(需在线)"
              selectedKeys={oneClickNodeId ? [String(oneClickNodeId)] : []}
              onSelectionChange={(k) => setOneClickNodeId(Number(Array.from(k)[0]))}
            >
              {nodes.map((n) => (
                <SelectItem key={n.id}>{n.name}</SelectItem>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setOneClickOpen(false)}>取消</Button>
            <Button color="secondary" isLoading={oneClickLoading} onPress={handleOneClick}>一键全建</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* 单独加一个协议(补充用) */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)}>
        <ModalContent>
          <ModalHeader>单独加一个协议</ModalHeader>
          <ModalBody className="space-y-3">
            <Select
              label="协议"
              selectedKeys={[createForm.protocol]}
              onSelectionChange={(k) => setCreateForm({ ...createForm, protocol: String(Array.from(k)[0]) })}
              description={
                isReality(createForm.protocol)
                  ? "无域名借 Reality(SNI 借壳),抗封锁强(推荐)"
                  : createForm.protocol === "vmess"
                  ? "VMess:TCP 无 TLS,无域名,兼容各种老客户端"
                  : ["hysteria2", "tuic", "anytls"].includes(createForm.protocol)
                  ? "自签证书(无域名);客户端需勾选\"允许不安全/insecure\"。Hy2/TUIC 是 QUIC,快"
                  : "Shadowsocks-2022:无 TLS、任何客户端都通,简单稳"
              }
            >
              <SelectItem key="vless">VLESS-Reality(无域名,推荐)</SelectItem>
              <SelectItem key="trojan">Trojan-Reality(无域名)</SelectItem>
              <SelectItem key="vmess">VMess(无域名,兼容老客户端)</SelectItem>
              <SelectItem key="hysteria2">Hysteria2(QUIC,快,自签证书)</SelectItem>
              <SelectItem key="tuic">TUIC(QUIC,自签证书)</SelectItem>
              <SelectItem key="anytls">AnyTLS(自签证书)</SelectItem>
            </Select>
            <Select
              label="机器"
              placeholder="选一台机器"
              selectedKeys={createForm.nodeId ? [String(createForm.nodeId)] : []}
              onSelectionChange={(k) => setCreateForm({ ...createForm, nodeId: Number(Array.from(k)[0]) })}
            >
              {nodes.map((n) => (
                <SelectItem key={n.id}>{n.name}</SelectItem>
              ))}
            </Select>
            {isReality(createForm.protocol) && (
              <>
                <Input
                  label="SNI(借用的站点)"
                  value={createForm.sni}
                  onChange={(e) => setCreateForm({ ...createForm, sni: e.target.value })}
                  description="推荐 www.apple.com / www.icloud.com;别用 www.microsoft.com(它上了后量子,reality 握不上)"
                />
                <Input
                  label="Reality 目标(留空=同 SNI)"
                  value={createForm.dest}
                  onChange={(e) => setCreateForm({ ...createForm, dest: e.target.value })}
                />
              </>
            )}
            <Input
              label="备注"
              value={createForm.remark}
              onChange={(e) => setCreateForm({ ...createForm, remark: e.target.value })}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setCreateOpen(false)}>取消</Button>
            <Button color="primary" isLoading={createLoading} onPress={handleCreate}>创建</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
