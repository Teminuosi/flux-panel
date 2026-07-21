import { useState, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import toast from "react-hot-toast";
import {
  getInboundList,
  createInbound,
  oneClickInbound,
  deleteInbound,
  assignInboundUser,
  getNodeList,
  getAllUsers,
  getSpeedLimitList,
} from "@/api";
import { copyTextToClipboard } from "@/utils/clipboard";

/**
 * 协议管理(合体面板 · VLESS-Reality)。
 * 建入站 → 分配子账号(限速/到期/流量)→ 出客户端链接。
 * 客户端连的是该用户的 gost 公网口(被限速),落地到本机 sing-box 入站。
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

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState<any>({ inboundId: null, userId: null, speedId: null, expDays: null, flowGb: null });
  const [assignLoading, setAssignLoading] = useState(false);
  const [resultLink, setResultLink] = useState<string>("");

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

  const nodeName = (id: number) => nodes.find((n) => n.id === id)?.name || id;
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
        toast.success("一键添加完成:所有协议已建好");
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

  const openAssign = (inbound: any) => {
    setAssignForm({ inboundId: inbound.id, userId: null, speedId: null, expDays: null, flowGb: null });
    setResultLink("");
    setAssignOpen(true);
  };

  const handleAssign = async () => {
    if (!assignForm.userId) return toast.error("请选择用户");
    setAssignLoading(true);
    try {
      const payload: any = { inboundId: assignForm.inboundId, userId: assignForm.userId };
      if (assignForm.speedId) payload.speedId = assignForm.speedId;
      if (assignForm.expDays) payload.expTime = Date.now() + assignForm.expDays * 86400000;
      if (assignForm.flowGb) payload.flow = Math.round(assignForm.flowGb * 1024 * 1024 * 1024);
      const res = await assignInboundUser(payload);
      if (res.code === 0) {
        toast.success("已分配");
        setResultLink(res.data?.link || "");
      } else {
        toast.error(res.msg || "分配失败");
      }
    } catch (e) {
      toast.error("分配失败");
    }
    setAssignLoading(false);
  };

  const handleDelete = async (id: number) => {
    const res = await deleteInbound(id);
    if (res.code === 0) {
      toast.success("已删除");
      loadAll();
    } else {
      toast.error(res.msg || "删除失败");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">协议管理</h1>
        <div className="flex gap-2">
          <Button
            color="secondary"
            variant="flat"
            onPress={() => {
              setOneClickNodeId(null);
              setOneClickOpen(true);
            }}
          >
            ⚡ 一键添加
          </Button>
          <Button
            color="primary"
            onPress={() => {
              setCreateForm({ nodeId: null, protocol: "vless", sni: "www.apple.com", dest: "", remark: "" });
              setCreateOpen(true);
            }}
          >
            新增入站
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        {nodes
          .filter((n) => inbounds.some((ib) => ib.nodeId === n.id))
          .map((n) => {
            const nodeInbounds = inbounds.filter((ib) => ib.nodeId === n.id);
            return (
              <div key={n.id} className="space-y-2">
                <div className="flex items-center gap-2 border-b border-default-200 pb-1">
                  <span className="font-semibold">🖥️ {n.name}</span>
                  <Chip size="sm" variant="flat" color="primary">{nodeInbounds.length} 个协议</Chip>
                </div>
                <div className="grid gap-2 md:grid-cols-2 pl-1">
                  {nodeInbounds.map((ib) => (
                    <Card key={ib.id}>
                      <CardBody className="flex flex-row justify-between items-center">
                        <div className="space-y-1 min-w-0">
                          <div className="font-semibold flex items-center gap-2">
                            <span className="truncate">{ib.remark || ib.tag}</span>
                            <Chip size="sm" color="secondary">{protoLabel(ib.protocol)}</Chip>
                          </div>
                          <div className="text-xs text-default-500 truncate">
                            本机口: {ib.listenPort}
                            {isReality(ib.protocol) ? ` · SNI: ${ib.sni}` : " · 无域名无证书"}
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <Button size="sm" color="primary" variant="flat" onPress={() => openAssign(ib)}>
                            分配用户
                          </Button>
                          <Button size="sm" color="danger" variant="flat" onPress={() => handleDelete(ib.id)}>
                            删除
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        {inbounds.length === 0 && (
          <div className="text-center text-default-400 py-8">还没有入站,点右上角「一键添加」或「新增入站」</div>
        )}
      </div>

      {/* 一键添加:选节点,把所有支持的协议一键全建出来 */}
      <Modal isOpen={oneClickOpen} onClose={() => setOneClickOpen(false)}>
        <ModalContent>
          <ModalHeader>⚡ 一键添加所有协议</ModalHeader>
          <ModalBody className="space-y-3">
            <div className="text-sm text-default-500">
              在选中的节点上一键建好全部协议:<b>VLESS-Reality、Trojan-Reality、VMess、Shadowsocks、Hysteria2、TUIC、AnyTLS</b>(端口、密钥、自签证书全自动)。建好后各自「分配用户」出链接即可。
            </div>
            <Select
              label="节点"
              placeholder="选一台节点(需在线)"
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

      {/* 新建入站 */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)}>
        <ModalContent>
          <ModalHeader>新增入站</ModalHeader>
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
              <SelectItem key="shadowsocks">Shadowsocks-2022(简单稳)</SelectItem>
              <SelectItem key="hysteria2">Hysteria2(QUIC,快,自签证书)</SelectItem>
              <SelectItem key="tuic">TUIC(QUIC,自签证书)</SelectItem>
              <SelectItem key="anytls">AnyTLS(自签证书)</SelectItem>
            </Select>
            <Select
              label="节点"
              placeholder="选一台节点"
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

      {/* 分配用户 */}
      <Modal isOpen={assignOpen} onClose={() => setAssignOpen(false)}>
        <ModalContent>
          <ModalHeader>分配用户(限速 + 到期 + 流量)</ModalHeader>
          <ModalBody className="space-y-3">
            <Select
              label="子账号(车友)"
              placeholder="选一个子账号"
              selectedKeys={assignForm.userId ? [String(assignForm.userId)] : []}
              onSelectionChange={(k) => setAssignForm({ ...assignForm, userId: Number(Array.from(k)[0]) })}
            >
              {users.map((u) => (
                <SelectItem key={u.id}>{u.user}</SelectItem>
              ))}
            </Select>
            <Select
              label="限速规则(可空)"
              placeholder="不限速"
              selectedKeys={assignForm.speedId ? [String(assignForm.speedId)] : []}
              onSelectionChange={(k) => setAssignForm({ ...assignForm, speedId: Number(Array.from(k)[0]) })}
            >
              {speedRules.map((s) => (
                <SelectItem key={s.id}>{s.name}</SelectItem>
              ))}
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
            {resultLink && (
              <div className="space-y-2">
                <div className="text-xs text-success">✅ 客户端链接(发给车友):</div>
                <Textarea readOnly value={resultLink} minRows={3} />
                <Button
                  size="sm"
                  color="primary"
                  onPress={async () => {
                    (await copyTextToClipboard(resultLink)) ? toast.success("已复制") : toast.error("复制失败,手动选择");
                  }}
                >
                  复制链接
                </Button>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setAssignOpen(false)}>关闭</Button>
            <Button color="primary" isLoading={assignLoading} onPress={handleAssign}>分配并出链接</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
