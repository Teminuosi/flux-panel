import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import toast from 'react-hot-toast';


import { 
  createSpeedLimit, 
  getSpeedLimitList, 
  updateSpeedLimit, 
  deleteSpeedLimit, 
  getTunnelList 
} from "@/api";

interface SpeedLimitRule {
  id: number;
  name: string;
  speed: number;
  mode: number;
  total: number;
  status: number;
  tunnelId: number;
  tunnelName: string;
  createdTime: string;
  updatedTime: string;
}

interface Tunnel {
  id: number;
  name: string;
}

interface SpeedLimitForm {
  id?: number;
  name: string;
  speed: number;
  mode: number;
  total: number;
  tunnelId: number | null;
  tunnelName: string;
  status: number;
}

export default function LimitPage() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<SpeedLimitRule[]>([]);
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  
  // 模态框状态
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<SpeedLimitRule | null>(null);
  
  // 表单状态
  const [form, setForm] = useState<SpeedLimitForm>({
    name: '',
    speed: 100,
    mode: 0,
    total: 0,
    tunnelId: null,
    tunnelName: '',
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
      const [rulesRes, tunnelsRes] = await Promise.all([
        getSpeedLimitList(),
        getTunnelList()
      ]);
      
      if (rulesRes.code === 0) {
        setRules(rulesRes.data || []);
      } else {
        toast.error(rulesRes.msg || '获取限速规则失败');
      }
      
      if (tunnelsRes.code === 0) {
        setTunnels(tunnelsRes.data || []);
      } else {
        console.warn('获取隧道列表失败:', tunnelsRes.msg);
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
      newErrors.name = '请输入规则名称';
    } else if (form.name.length < 2 || form.name.length > 50) {
      newErrors.name = '规则名称长度应在2-50个字符之间';
    }
    
    if (!form.speed || form.speed < 1) {
      newErrors.speed = '请输入有效的速度限制（≥1 Mbps）';
    }

    // 隧道可选:合体面板的协议限速不用绑隧道(分配协议用户时自动把限速器推到协议节点)

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 新增规则
  const handleAdd = () => {
    setIsEdit(false);
    setForm({
      name: '',
      speed: 100,
      mode: 0,
      total: 0,
      tunnelId: null,
      tunnelName: '',
      status: 1
    });
    setErrors({});
    setModalOpen(true);
  };

  // 编辑规则
  const handleEdit = (rule: SpeedLimitRule) => {
    setIsEdit(true);
    setForm({
      id: rule.id,
      name: rule.name,
      speed: rule.speed,
      mode: rule.mode ?? 0,
      total: rule.total ?? 0,
      tunnelId: rule.tunnelId,
      tunnelName: rule.tunnelName,
      status: rule.status
    });
    setErrors({});
    setModalOpen(true);
  };

  // 显示删除确认
  const handleDelete = (rule: SpeedLimitRule) => {
    setRuleToDelete(rule);
    setDeleteModalOpen(true);
  };

  // 确认删除规则
  const confirmDelete = async () => {
    if (!ruleToDelete) return;
    
    setDeleteLoading(true);
    try {
      const res = await deleteSpeedLimit(ruleToDelete.id);
      if (res.code === 0) {
        toast.success('删除成功');
        setDeleteModalOpen(false);
        loadData();
      } else {
        toast.error(res.msg || '删除失败');
      }
    } catch (error) {
      console.error('删除失败:', error);
      toast.error('删除失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setSubmitLoading(true);
    try {
      let res;
      if (isEdit) {
        res = await updateSpeedLimit(form);
      } else {
        const { id, ...createData } = form;
        res = await createSpeedLimit(createData);
      }
      
      if (res.code === 0) {
        toast.success(isEdit ? '修改成功' : '创建成功');
        setModalOpen(false);
        loadData();
      } else {
        toast.error(res.msg || '操作失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
      toast.error('操作失败');
    } finally {
      setSubmitLoading(false);
    }
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

        {/* 统一卡片网格 */}
        {rules.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {rules.map((rule) => (
              <Card key={rule.id} className="shadow-sm border border-gray-200 dark:border-gray-700">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start w-full">
                    <div>
                      <h3 className="font-semibold text-foreground">{rule.name}</h3>
                    </div>
                    <Chip 
                      color={rule.status === 1 ? "success" : "danger"} 
                      variant="flat" 
                      size="sm"
                    >
                      {rule.status === 1 ? '运行' : '异常'}
                    </Chip>
                  </div>
                </CardHeader>
                <CardBody className="pt-0">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-small text-default-600">速度限制</span>
                      <Chip color="secondary" variant="flat" size="sm">
                        {rule.speed} Mbps
                      </Chip>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-small text-default-600">绑定隧道</span>
                      {rule.tunnelName ? (
                        <Chip color="primary" variant="flat" size="sm">
                          {rule.tunnelName}
                        </Chip>
                      ) : (
                        <span className="text-default-400 text-small">未绑定</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      onPress={() => handleEdit(rule)}
                      className="flex-1"
                      startContent={
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      }
                    >
                      编辑
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      onPress={() => handleDelete(rule)}
                      className="flex-1"
                      startContent={
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
            ))}
          </div>
        ) : (
          /* 空状态 */
          <Card className="shadow-sm border border-gray-200 dark:border-gray-700">
            <CardBody className="text-center py-16">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-default-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6l4 2m6-6a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">暂无限速规则</h3>
                  <p className="text-default-500 text-sm mt-1">还没有创建任何限速规则，点击上方按钮开始创建</p>
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
                    {isEdit ? '编辑限速规则' : '新增限速规则'}
                  </h2>
                  <p className="text-small text-default-500">
                    {isEdit ? '修改现有限速规则的配置信息' : '创建新的限速规则并绑定到隧道'}
                  </p>
                </ModalHeader>
                <ModalBody>
                  <div className="space-y-4">
                    <Input
                      label="规则名称"
                      placeholder="请输入限速规则名称"
                      value={form.name}
                      onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                      isInvalid={!!errors.name}
                      errorMessage={errors.name}
                      variant="bordered"
                    />
                    
                    <Input
                      label="速度限制"
                      placeholder="请输入速度限制"
                      type="number"
                      value={form.speed.toString()}
                      onChange={(e) => setForm(prev => ({ ...prev, speed: parseInt(e.target.value) || 0 }))}
                      isInvalid={!!errors.speed}
                      errorMessage={errors.speed}
                      variant="bordered"
                      endContent={
                        <div className="pointer-events-none flex items-center">
                          <span className="text-default-400 text-small">Mbps</span>
                        </div>
                      }
                    />

                    <Select
                      label="限速模式"
                      placeholder="选择限速粒度"
                      selectedKeys={[String(form.mode ?? 0)]}
                      onSelectionChange={(keys) => {
                        const k = Array.from(keys)[0] as string;
                        setForm(prev => ({ ...prev, mode: parseInt(k) || 0 }));
                      }}
                      variant="bordered"
                      description="每客户端IP:防单人吃满带宽"
                    >
                      <SelectItem key="0">共享(整条限速器一个池)</SelectItem>
                      <SelectItem key="1">每连接各自封顶</SelectItem>
                      <SelectItem key="2">每客户端IP各自封顶</SelectItem>
                    </Select>

                    <Input
                      label="总带宽天花板"
                      placeholder="0 = 不设"
                      type="number"
                      value={(form.total ?? 0).toString()}
                      onChange={(e) => setForm(prev => ({ ...prev, total: parseInt(e.target.value) || 0 }))}
                      variant="bordered"
                      description="整条限速器总带宽上限,与上面每IP/每连接叠加,防机房限流。0=不限"
                      endContent={
                        <div className="pointer-events-none flex items-center">
                          <span className="text-default-400 text-small">Mbps</span>
                        </div>
                      }
                    />

                    <Select
                      label="绑定隧道(可选)"
                      placeholder="协议限速可不选;转发限速才需要选隧道"
                      selectedKeys={form.tunnelId ? [form.tunnelId.toString()] : []}
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;
                        if (selectedKey) {
                          const selectedTunnel = tunnels.find(tunnel => tunnel.id === parseInt(selectedKey));
                          setForm(prev => ({ 
                            ...prev, 
                            tunnelId: parseInt(selectedKey),
                            tunnelName: selectedTunnel?.name || ''
                          }));
                        } else {
                          setForm(prev => ({ 
                            ...prev, 
                            tunnelId: null,
                            tunnelName: ''
                          }));
                        }
                      }}
                      isInvalid={!!errors.tunnelId}
                      errorMessage={errors.tunnelId}
                      variant="bordered"
                    >
                      {tunnels.map((tunnel) => (
                        <SelectItem key={tunnel.id}>
                          {tunnel.name}
                        </SelectItem>
                      ))}
                    </Select>
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
                    {isEdit ? '保存修改' : '创建规则'}
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
                  <h2 className="text-lg font-bold text-danger">确认删除</h2>
                </ModalHeader>
                <ModalBody>
                  <p className="text-default-600">
                    确定要删除限速规则 <span className="font-semibold text-foreground">"{ruleToDelete?.name}"</span> 吗？
                  </p>
                  <p className="text-small text-default-500 mt-2">
                    此操作无法撤销，删除后该规则将永久消失。
                  </p>
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
                    确认删除
                  </Button>
                </ModalFooter>
              </>
            )}
          </ModalContent>
        </Modal>
      </div>
    
  );
} 