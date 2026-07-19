import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Divider } from "@heroui/divider";
import { Alert } from "@heroui/alert";
import toast from 'react-hot-toast';


import { 
  createTunnel, 
  getTunnelList, 
  updateTunnel, 
  deleteTunnel,
  getNodeList,
  diagnoseTunnel
} from "@/api";

interface Tunnel {
  id: number;
  name: string;
  type: number; // 1: 端口转发, 2: 隧道转发
  inNodeId: number;
  outNodeId?: number;
  inIp: string;
  outIp?: string;
  protocol?: string;
  tcpListenAddr: string;
  udpListenAddr: string;
  interfaceName?: string;
  flow: number; // 1: 单向, 2: 双向
  trafficRatio: number;
  status: number;
  createdTime: string;
}

interface Node {
  id: number;
  name: string;
  status: number; // 1: 在线, 0: 离线
}

interface TunnelForm {
  id?: number;
  name: string;
  type: number;
  inNodeId: number | null;
  outNodeId?: number | null;
  protocol: string;
  tcpListenAddr: string;
  udpListenAddr: string;
  interfaceName?: string;
  flow: number;
  trafficRatio: number;
  status: number;
}

interface DiagnosisResult {
  tunnelName: string;
  tunnelType: string;
  timestamp: number;
  results: Array<{
    success: boolean;
    description: string;
    nodeName: string;
    nodeId: string;
    targetIp: string;
    targetPort?: number;
    message?: string;
    averageTime?: number;
    packetLoss?: number;
  }>;
}

export default function TunnelPage() {
  const [loading, setLoading] = useState(true);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  
  // 模态框状态
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [diagnosisModalOpen, setDiagnosisModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);
  const [tunnelToDelete, setTunnelToDelete] = useState<Tunnel | null>(null);
  const [currentDiagnosisTunnel, setCurrentDiagnosisTunnel] = useState<Tunnel | null>(null);
  const [diagnosisResult, setDiagnosisResult] = useState<DiagnosisResult | null>(null);
  
  // 表单状态
  const [form, setForm] = useState<TunnelForm>({
    name: '',
    type: 1,
    inNodeId: null,
    outNodeId: null,
    protocol: 'tls',
    tcpListenAddr: '[::]',
    udpListenAddr: '[::]',
    interfaceName: '',
    flow: 1,
    trafficRatio: 1.0,
    status: 1
  });
  
  // 表单验证错误
  const [errors, setErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    loadData();
  }, []);

  // 加载所有数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [tunnelsRes, nodesRes] = await Promise.all([
        getTunnelList(),
        getNodeList()
      ]);
      
      if (tunnelsRes.code === 0) {
        setTunnels(tunnelsRes.data || []);
      } else {
        toast.error(tunnelsRes.msg || '获取隧道列表失败');
      }
      
      if (nodesRes.code === 0) {
        setNodes(nodesRes.data || []);
      } else {
        console.warn('获取转发机列表失败:', nodesRes.msg);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 表单验证
  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};
    
    if (!form.name.trim()) {
      newErrors.name = '请输入隧道名称';
    } else if (form.name.length < 2 || form.name.length > 50) {
      newErrors.name = '隧道名称长度应在2-50个字符之间';
    }
    
    if (!form.inNodeId) {
      newErrors.inNodeId = '请选择入口转发机';
    }
    
    if (!form.tcpListenAddr.trim()) {
      newErrors.tcpListenAddr = '请输入TCP监听地址';
    }
    
    if (!form.udpListenAddr.trim()) {
      newErrors.udpListenAddr = '请输入UDP监听地址';
    }
    
    if (form.trafficRatio < 0.0 || form.trafficRatio > 100.0) {
      newErrors.trafficRatio = '流量倍率必须在0.0-100.0之间';
    }
    
    // 隧道转发时的验证
    if (form.type === 2) {
      if (!form.outNodeId) {
        newErrors.outNodeId = '请选择出口转发机';
      } else if (form.inNodeId === form.outNodeId) {
        newErrors.outNodeId = '隧道转发模式下，入口和出口不能是同一个转发机';
      }
      
      if (!form.protocol) {
        newErrors.protocol = '请选择协议类型';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 新增隧道
  const handleAdd = () => {
    setIsEdit(false);
    setForm({
      name: '',
      type: 1,
      inNodeId: null,
      outNodeId: null,
      protocol: 'tls',
      tcpListenAddr: '[::]',
      udpListenAddr: '[::]',
      interfaceName: '',
      flow: 1,
      trafficRatio: 1.0,
      status: 1
    });
    setErrors({});
    setModalOpen(true);
  };

  // 编辑隧道 - 只能修改部分字段
  const handleEdit = (tunnel: Tunnel) => {
    setIsEdit(true);
    setForm({
      id: tunnel.id,
      name: tunnel.name,
      type: tunnel.type,
      inNodeId: tunnel.inNodeId,
      outNodeId: tunnel.outNodeId || null,
      protocol: tunnel.protocol || 'tls',
      tcpListenAddr: tunnel.tcpListenAddr || '[::]',
      udpListenAddr: tunnel.udpListenAddr || '[::]',
      interfaceName: tunnel.interfaceName || '',
      flow: tunnel.flow,
      trafficRatio: tunnel.trafficRatio,
      status: tunnel.status
    });
    setErrors({});
    setModalOpen(true);
  };

  // 删除隧道
  const handleDelete = (tunnel: Tunnel) => {
    setTunnelToDelete(tunnel);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!tunnelToDelete) return;
    
    setDeleteLoading(true);
    try {
      const response = await deleteTunnel(tunnelToDelete.id);
      if (response.code === 0) {
        toast.success('删除成功');
        setDeleteModalOpen(false);
        setTunnelToDelete(null);
        loadData();
      } else {
        toast.error(response.msg || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 隧道类型改变时的处理
  const handleTypeChange = (type: number) => {
    setForm(prev => ({
      ...prev,
      type,
      outNodeId: type === 1 ? null : prev.outNodeId,
      protocol: type === 1 ? 'tls' : prev.protocol
    }));
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setSubmitLoading(true);
    try {
      const data = { ...form };
      
      const response = isEdit 
        ? await updateTunnel(data)
        : await createTunnel(data);
        
      if (response.code === 0) {
        toast.success(isEdit ? '更新成功' : '创建成功');
        setModalOpen(false);
        loadData();
      } else {
        toast.error(response.msg || (isEdit ? '更新失败' : '创建失败'));
      }
    } catch (error) {
      console.error('提交失败:', error);
      toast.error('网络错误，请重试');
    } finally {
      setSubmitLoading(false);
    }
  };

  // 诊断隧道
  const handleDiagnose = async (tunnel: Tunnel) => {
    setCurrentDiagnosisTunnel(tunnel);
    setDiagnosisModalOpen(true);
    setDiagnosisLoading(true);
    setDiagnosisResult(null);

    try {
      const response = await diagnoseTunnel(tunnel.id);
      if (response.code === 0) {
        setDiagnosisResult(response.data);
      } else {
        toast.error(response.msg || '诊断失败');
        setDiagnosisResult({
          tunnelName: tunnel.name,
          tunnelType: tunnel.type === 1 ? '端口转发' : '隧道转发',
          timestamp: Date.now(),
          results: [{
            success: false,
            description: '诊断失败',
            nodeName: '-',
            nodeId: '-',
            targetIp: '-',
            targetPort: 443,
            message: response.msg || '诊断过程中发生错误'
          }]
        });
      }
    } catch (error) {
      console.error('诊断失败:', error);
      toast.error('网络错误，请重试');
      setDiagnosisResult({
        tunnelName: tunnel.name,
        tunnelType: tunnel.type === 1 ? '端口转发' : '隧道转发',
        timestamp: Date.now(),
        results: [{
          success: false,
          description: '网络错误',
          nodeName: '-',
          nodeId: '-',
          targetIp: '-',
          targetPort: 443,
          message: '无法连接到服务器'
        }]
      });
    } finally {
      setDiagnosisLoading(false);
    }
  };

  // 获取显示的IP（处理多IP）
  const getDisplayIp = (ipString?: string): string => {
    if (!ipString) return '-';
    
    const ips = ipString.split(',').map(ip => ip.trim()).filter(ip => ip);
    
    if (ips.length === 0) return '-';
    if (ips.length === 1) return ips[0];
    
    return `${ips[0]} 等${ips.length}个`;
  };

  // 获取转发机名称
  const getNodeName = (nodeId?: number): string => {
    if (!nodeId) return '-';
    const node = nodes.find(n => n.id === nodeId);
    return node ? node.name : `转发机${nodeId}`;
  };

  // 获取状态显示
  const getStatusDisplay = (status: number) => {
    switch (status) {
      case 1:
        return { text: '启用', color: 'success' };
      case 0:
        return { text: '禁用', color: 'default' };
      default:
        return { text: '未知', color: 'warning' };
    }
  };

  // 获取类型显示
  const getTypeDisplay = (type: number) => {
    switch (type) {
      case 1:
        return { text: '端口转发', color: 'primary' };
      case 2:
        return { text: '隧道转发', color: 'secondary' };
      default:
        return { text: '未知', color: 'default' };
    }
  };

  // 获取流量计算显示
  const getFlowDisplay = (flow: number) => {
    switch (flow) {
      case 1:
        return '单向计算';
      case 2:
        return '双向计算';
      default:
        return '未知';
    }
  };


  // 获取连接质量
  const getQualityDisplay = (averageTime?: number, packetLoss?: number) => {
    if (averageTime === undefined || packetLoss === undefined) return null;
    
    if (averageTime < 30 && packetLoss === 0) return { text: '🚀 优秀', color: 'success' };
    if (averageTime < 50 && packetLoss === 0) return { text: '✨ 很好', color: 'success' };
    if (averageTime < 100 && packetLoss < 1) return { text: '👍 良好', color: 'primary' };
    if (averageTime < 150 && packetLoss < 2) return { text: '😐 一般', color: 'warning' };
    if (averageTime < 200 && packetLoss < 5) return { text: '😟 较差', color: 'warning' };
    return { text: '😵 很差', color: 'danger' };
  };

  if (loading) {
    return (
      
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <span className="text-default-600">正在加载...</span>
          </div>
        </div>
      
    );
  }

  return (
    
      <div className="px-3 lg:px-6 py-8">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
        </div>

        <Button
              size="sm"
              variant="flat"
              color="primary"
              onPress={handleAdd}
             
            >
              新增
            </Button>
     
        </div>

        {/* 隧道卡片网格 */}
        {tunnels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {tunnels.map((tunnel) => {
              const statusDisplay = getStatusDisplay(tunnel.status);
              const typeDisplay = getTypeDisplay(tunnel.type);
              
              return (
                <Card key={tunnel.id} className="shadow-sm border border-divider hover:shadow-md transition-shadow duration-200">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start w-full">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate text-sm">{tunnel.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Chip 
                            color={typeDisplay.color as any} 
                            variant="flat" 
                            size="sm"
                            className="text-xs"
                          >
                            {typeDisplay.text}
                          </Chip>
                          <Chip 
                            color={statusDisplay.color as any} 
                            variant="flat" 
                            size="sm"
                            className="text-xs"
                          >
                            {statusDisplay.text}
                          </Chip>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardBody className="pt-0 pb-3">
                    <div className="space-y-2">
                      {/* 流程展示 */}
                      <div className="space-y-1.5">
                        <div className="p-2 bg-default-50 dark:bg-default-100/50 rounded border border-default-200 dark:border-default-300">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-default-600">入口转发机</span>
                          </div>
                          <code className="text-xs font-mono text-foreground block truncate">
                            {getNodeName(tunnel.inNodeId)}
                          </code>
                          <code className="text-xs font-mono text-default-500 block truncate">
                            {getDisplayIp(tunnel.inIp)}
                          </code>
                        </div>
                        
                        <div className="text-center py-0.5">
                          <svg className="w-3 h-3 text-default-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        </div>
                        
                        <div className="p-2 bg-default-50 dark:bg-default-100/50 rounded border border-default-200 dark:border-default-300">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-default-600">
                              {tunnel.type === 1 ? '出口转发机（同入口）' : '出口转发机'}
                            </span>
                          </div>
                          <code className="text-xs font-mono text-foreground block truncate">
                            {tunnel.type === 1 ? getNodeName(tunnel.inNodeId) : getNodeName(tunnel.outNodeId)}
                          </code>
                          <code className="text-xs font-mono text-default-500 block truncate">
                            {tunnel.type === 1 ? getDisplayIp(tunnel.inIp) : getDisplayIp(tunnel.outIp)}
                          </code>
                        </div>
                      </div>

                      {/* 配置信息 */}
                      <div className="flex justify-between items-center pt-2 border-t border-divider">
                        <div className="text-left">
                          <div className="text-xs font-medium text-foreground">
                            {getFlowDisplay(tunnel.flow)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-medium text-foreground">
                            {tunnel.trafficRatio}x
                          </div>
                        </div>
                      </div>

                    </div>
                    
                    <div className="flex gap-1.5 mt-3">
                      <Button
                        size="sm"
                        variant="flat"
                        color="primary"
                        onPress={() => handleEdit(tunnel)}
                        className="flex-1 min-h-8"
                        startContent={
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        }
                      >
                        编辑
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        color="warning"
                        onPress={() => handleDiagnose(tunnel)}
                        className="flex-1 min-h-8"
                        startContent={
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        }
                      >
                        诊断
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={() => handleDelete(tunnel)}
                        className="flex-1 min-h-8"
                        startContent={
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 012 0v4a1 1 0 11-2 0V7zM12 7a1 1 0 012 0v4a1 1 0 11-2 0V7z" clipRule="evenodd" />
                          </svg>
                        }
                      >
                        删除
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        ) : (
          /* 空状态 */
          <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
            <CardBody className="text-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-default-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">暂无隧道配置</h3>
                  <p className="text-default-500 text-sm mt-1">还没有创建任何隧道配置，点击上方按钮开始创建</p>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {/* 新增/编辑模态框 */}
        <Modal 
          isOpen={modalOpen}
          onOpenChange={setModalOpen}
          size="2xl"
        scrollBehavior="outside"
        backdrop="blur"
        placement="center"
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <h2 className="text-xl font-bold">
                    {isEdit ? '编辑隧道' : '新增隧道'}
                  </h2>
                  <p className="text-small text-default-500">
                    {isEdit ? '修改现有隧道配置的信息' : '创建新的隧道配置'}
                  </p>
                </ModalHeader>
                <ModalBody>
                  <div className="space-y-4">
                    <Input
                      label="隧道名称"
                      placeholder="请输入隧道名称"
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      isInvalid={!!errors.name}
                      errorMessage={errors.name}
                      variant="bordered"
                    />
                    
                    <Select
                      label="隧道类型"
                      placeholder="请选择隧道类型"
                      selectedKeys={[form.type.toString()]}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;
                        if (selectedKey) {
                          handleTypeChange(parseInt(selectedKey));
                        }
                      }}
                      isInvalid={!!errors.type}
                      errorMessage={errors.type}
                      variant="bordered"
                      isDisabled={isEdit}
                    >
                      <SelectItem key="1">端口转发</SelectItem>
                      <SelectItem key="2">隧道转发</SelectItem>
                    </Select>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Select
                        label="流量计算"
                        placeholder="请选择流量计算方式"
                        selectedKeys={[form.flow.toString()]}
                        onSelectionChange={(keys) => {
                          const selectedKey = Array.from(keys)[0] as string;
                          if (selectedKey) {
                            setForm(prev => ({ ...prev, flow: parseInt(selectedKey) }));
                          }
                        }}
                        isInvalid={!!errors.flow}
                        errorMessage={errors.flow}
                        variant="bordered"
                      >
                        <SelectItem key="1">单向计算（仅上传）</SelectItem>
                        <SelectItem key="2">双向计算（上传+下载）</SelectItem>
                      </Select>

                      <Input
                        label="流量倍率"
                        placeholder="请输入流量倍率"
                        type="number"
                        value={form.trafficRatio.toString()}
                        onChange={(e) => setForm(prev => ({ 
                          ...prev, 
                          trafficRatio: parseFloat(e.target.value) || 0
                        }))}
                        isInvalid={!!errors.trafficRatio}
                        errorMessage={errors.trafficRatio}
                        variant="bordered"
                        endContent={
                          <div className="pointer-events-none flex items-center">
                            <span className="text-default-400 text-small">x</span>
                          </div>
                        }
                      />
                    </div>

                    <Divider />
                    <h3 className="text-lg font-semibold">入口配置</h3>

                    <Select
                      label="入口转发机"
                      placeholder="请选择入口转发机"
                      selectedKeys={form.inNodeId ? [form.inNodeId.toString()] : []}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;
                        if (selectedKey) {
                          setForm(prev => ({ ...prev, inNodeId: parseInt(selectedKey) }));
                        }
                      }}
                      isInvalid={!!errors.inNodeId}
                      errorMessage={errors.inNodeId}
                      variant="bordered"
                      isDisabled={isEdit}
                    >
                      {nodes.map((node) => (
                        <SelectItem 
                          key={node.id}
                          textValue={`${node.name} (${node.status === 1 ? '在线' : '离线'})`}
                        >
                          <div className="flex items-center justify-between">
                            <span>{node.name}</span>
                            <Chip 
                              color={node.status === 1 ? 'success' : 'danger'} 
                              variant="flat" 
                              size="sm"
                            >
                              {node.status === 1 ? '在线' : '离线'}
                            </Chip>
                          </div>
                        </SelectItem>
                      ))}
                    </Select>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="TCP监听地址"
                        placeholder="请输入TCP监听地址"
                        value={form.tcpListenAddr}
                        onChange={(e) => setForm(prev => ({ ...prev, tcpListenAddr: e.target.value }))}
                        isInvalid={!!errors.tcpListenAddr}
                        errorMessage={errors.tcpListenAddr}
                        variant="bordered"
                        startContent={
                          <div className="pointer-events-none flex items-center">
                            <span className="text-default-400 text-small">TCP</span>
                          </div>
                        }
                      />

                      <Input
                        label="UDP监听地址"
                        placeholder="请输入UDP监听地址"
                        value={form.udpListenAddr}
                        onChange={(e) => setForm(prev => ({ ...prev, udpListenAddr: e.target.value }))}
                        isInvalid={!!errors.udpListenAddr}
                        errorMessage={errors.udpListenAddr}
                        variant="bordered"
                        startContent={
                          <div className="pointer-events-none flex items-center">
                            <span className="text-default-400 text-small">UDP</span>
                          </div>
                        }
                      />
                    </div>

                    {/* 隧道转发时显示出口网卡配置 */}
                    {form.type === 2 && (
                      <Input
                        label="出口网卡名或IP（一般留空）"
                        placeholder="留空即可（多IP本机才填，不是目标地址）"
                        value={form.interfaceName}
                        onChange={(e) => setForm(prev => ({ ...prev, interfaceName: e.target.value }))}
                        isInvalid={!!errors.interfaceName}
                        errorMessage={errors.interfaceName}
                        variant="bordered"
                      />
                    )}

                    {/* 隧道转发时显示出口配置 */}
                    {form.type === 2 && (
                      <>
                        <Divider />
                        <h3 className="text-lg font-semibold">出口配置</h3>

                        <Select
                          label="协议类型"
                          placeholder="请选择协议类型"
                          selectedKeys={[form.protocol]}
                          onSelectionChange={(keys) => {
                            const selectedKey = Array.from(keys)[0] as string;
                            if (selectedKey) {
                              setForm(prev => ({ ...prev, protocol: selectedKey }));
                            }
                          }}
                          isInvalid={!!errors.protocol}
                          errorMessage={errors.protocol}
                          variant="bordered"
                        >
                          <SelectItem key="tls">TLS</SelectItem>
                          <SelectItem key="wss">WSS</SelectItem>
                          <SelectItem key="tcp">TCP</SelectItem>
                          <SelectItem key="mtls">MTLS</SelectItem>
                          <SelectItem key="mwss">MWSS</SelectItem>
                          <SelectItem key="mtcp">MTCP</SelectItem>
                        </Select>

                        <Select
                          label="出口转发机"
                          placeholder="请选择出口转发机"
                          selectedKeys={form.outNodeId ? [form.outNodeId.toString()] : []}
                          onSelectionChange={(keys) => {
                            const selectedKey = Array.from(keys)[0] as string;
                            if (selectedKey) {
                              setForm(prev => ({ ...prev, outNodeId: parseInt(selectedKey) }));
                            }
                          }}
                          isInvalid={!!errors.outNodeId}
                          errorMessage={errors.outNodeId}
                          variant="bordered"
                          isDisabled={isEdit}
                        >
                          {nodes.map((node) => (
                            <SelectItem 
                              key={node.id}
                              textValue={`${node.name} (${node.status === 1 ? '在线' : '离线'})`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{node.name}</span>
                                <div className="flex items-center gap-2">
                                  <Chip 
                                    color={node.status === 1 ? 'success' : 'danger'} 
                                    variant="flat" 
                                    size="sm"
                                  >
                                    {node.status === 1 ? '在线' : '离线'}
                                  </Chip>
                                  {form.inNodeId === node.id && (
                                    <Chip color="warning" variant="flat" size="sm">
                                      已选为入口
                                    </Chip>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </Select>
                      </>
                    )}

                    <Alert
                        color="primary"
                        variant="flat"
                        title="TCP,UDP监听地址"
                        description="保持默认 [::] 就行——它是「监听本机所有网卡」的意思,不是要你填机器IP(机器已经在上面「入口转发机」里选好了)。纯 IPv4 环境可改 0.0.0.0。不懂就别动。"
                        className="mt-4"
                      />
                      <Alert
                        color="primary"
                        variant="flat"
                        title="出口网卡名或IP（一般留空）"
                        description="仅本机有多个IP、要指定用哪个本地IP去连出口机时才填，且填的是【本机】的本地IP/网卡名，不是目标地址！填错（比如填成香港或落地IP）会连不上，不懂就留空。"
                        className="mt-4"
                      />
                  </div>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>
                    取消
                  </Button>
                  <Button 
                    color="primary" 
                    onPress={handleSubmit}
                    isLoading={submitLoading}
                  >
                    {submitLoading ? (isEdit ? '更新中...' : '创建中...') : (isEdit ? '更新' : '创建')}
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* 删除确认模态框 */}
        <Modal 
          isOpen={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          size="2xl"
        scrollBehavior="outside"
        backdrop="blur"
        placement="center"
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <h2 className="text-xl font-bold">确认删除</h2>
                </ModalHeader>
                <ModalBody>
                  <p>确定要删除隧道 <strong>"{tunnelToDelete?.name}"</strong> 吗？</p>
                  <p className="text-small text-default-500">此操作不可恢复，请谨慎操作。</p>
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>
                    取消
                  </Button>
                  <Button 
                    color="danger" 
                    onPress={confirmDelete}
                    isLoading={deleteLoading}
                  >
                    {deleteLoading ? '删除中...' : '确认删除'}
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>

        {/* 诊断结果模态框 */}
        <Modal 
          isOpen={diagnosisModalOpen}
          onOpenChange={setDiagnosisModalOpen}
          size="2xl"
        scrollBehavior="outside"
        backdrop="blur"
        placement="center"
        >
          <ModalContent>
            {(onClose) => (
              <>
                <ModalHeader className="flex flex-col gap-1">
                  <h2 className="text-xl font-bold">隧道诊断结果</h2>
                  {currentDiagnosisTunnel && (
                    <div className="flex items-center gap-2">
                      <span className="text-small text-default-500">{currentDiagnosisTunnel.name}</span>
                      <Chip 
                        color={currentDiagnosisTunnel.type === 1 ? 'primary' : 'secondary'} 
                        variant="flat" 
                        size="sm"
                      >
                        {currentDiagnosisTunnel.type === 1 ? '端口转发' : '隧道转发'}
                      </Chip>
                    </div>
                  )}
                </ModalHeader>
                <ModalBody>
                  {diagnosisLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="flex items-center gap-3">
                        <Spinner size="sm" />
                        <span className="text-default-600">正在诊断...</span>
                      </div>
                    </div>
                  ) : diagnosisResult ? (
                    <div className="space-y-4">
                      {diagnosisResult.results.map((result, index) => {
                        const quality = getQualityDisplay(result.averageTime, result.packetLoss);
                        
                        return (
                          <Card key={index} className={`shadow-sm border ${result.success ? 'border-success' : 'border-danger'}`}>
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    result.success ? 'bg-success text-white' : 'bg-danger text-white'
                                  }`}>
                                    {result.success ? '✓' : '✗'}
                                  </div>
                                  <div>
                                    <h4 className="font-semibold">{result.description}</h4>
                                    <p className="text-small text-default-500">{result.nodeName}</p>
                                  </div>
                                </div>
                                <Chip 
                                  color={result.success ? 'success' : 'danger'} 
                                  variant="flat"
                                >
                                  {result.success ? '成功' : '失败'}
                                </Chip>
                              </div>
                            </CardHeader>
                            <CardBody className="pt-0">
                              {result.success ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                      <div className="text-2xl font-bold text-primary">{result.averageTime?.toFixed(0)}</div>
                                      <div className="text-small text-default-500">平均延迟(ms)</div>
                                    </div>
                                    <div className="text-center">
                                      <div className="text-2xl font-bold text-warning">{result.packetLoss?.toFixed(1)}</div>
                                      <div className="text-small text-default-500">丢包率(%)</div>
                                    </div>
                                    <div className="text-center">
                                      {quality && (
                                        <>
                                          <Chip color={quality.color as any} variant="flat" size="lg">
                                            {quality.text}
                                          </Chip>
                                          <div className="text-small text-default-500 mt-1">连接质量</div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-small text-default-500">
                                    目标地址: <code className="font-mono">{result.targetIp}{result.targetPort ? ':' + result.targetPort : ''}</code>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="text-small text-default-500">
                                    目标地址: <code className="font-mono">{result.targetIp}{result.targetPort ? ':' + result.targetPort : ''}</code>
                                  </div>
                                  <Alert
                                    color="danger"
                                    variant="flat"
                                    title="错误详情"
                                    description={result.message}
                                  />
                                </div>
                              )}
                            </CardBody>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-default-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">暂无诊断数据</h3>
                    </div>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button variant="light" onPress={onClose}>
                    关闭
                  </Button>
                  {currentDiagnosisTunnel && (
                    <Button 
                      color="primary" 
                      onPress={() => handleDiagnose(currentDiagnosisTunnel)}
                      isLoading={diagnosisLoading}
                    >
                      重新诊断
                    </Button>
                  )}
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    
  );
} 