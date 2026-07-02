import { Card, Form, Input, Button, Tabs, Space, Typography, Divider, message, InputNumber } from 'antd'
import { SaveOutlined, DeleteOutlined } from '@ant-design/icons'
import { useXfyunConfigStore } from '../store/xfyunConfigStore'
import { useApiConfigStore } from '../store/apiConfigStore'

const { Title, Text } = Typography
const { TabPane } = Tabs

export default function Settings() {
  const { config: xfyunConfig, updateConfig: updateXfyunConfig, clearConfig: clearXfyunConfig } = useXfyunConfigStore()
  const { apiConfigs, updateConfig: updateApiConfig } = useApiConfigStore()

  const [xfyunForm] = Form.useForm()
  const [deepseekForm] = Form.useForm()
  const deepseekConfig = apiConfigs.find(config => config.apiProvider === 'deepseek') || apiConfigs[0]

  const handleXfyunSave = (values: any) => {
    updateXfyunConfig(values.appId, values.apiKey, values.apiSecret)
    message.success('讯飞配置已保存')
  }

  const handleXfyunClear = () => {
    clearXfyunConfig()
    xfyunForm.resetFields()
    message.success('讯飞配置已清空')
  }

  const handleDeepSeekSave = (values: any) => {
    if (deepseekConfig) {
      updateApiConfig(deepseekConfig.seq, {
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
        model: values.model,
        maxTokens: values.maxTokens,
        temperature: values.temperature,
      })
      message.success('DeepSeek 配置已保存')
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>系统设置</Title>
      <Text type="secondary">配置 API 密钥和模型参数。</Text>

      <Divider />

      <Tabs defaultActiveKey="xfyun" type="card">
        <TabPane tab="讯飞实时转写" key="xfyun">
          <Card title="讯飞实时转写大模型">
            <Form
              form={xfyunForm}
              layout="vertical"
              onFinish={handleXfyunSave}
              initialValues={{
                appId: xfyunConfig.appId,
                apiKey: xfyunConfig.apiKey,
                apiSecret: xfyunConfig.apiSecret,
              }}
            >
              <Form.Item
                label="APPID"
                name="appId"
                rules={[{ required: true, message: '请填写讯飞 APPID' }]}
              >
                <Input placeholder="来自 console.xfyun.cn/services/new_rta 的 APPID" size="large" />
              </Form.Item>

              <Form.Item
                label="APIKey"
                name="apiKey"
                rules={[{ required: true, message: '请填写讯飞 APIKey' }]}
              >
                <Input.Password placeholder="来自 console.xfyun.cn/services/new_rta 的 APIKey" size="large" />
              </Form.Item>

              <Form.Item
                label="APISecret"
                name="apiSecret"
                rules={[{ required: true, message: '请填写讯飞 APISecret' }]}
              >
                <Input.Password placeholder="来自 console.xfyun.cn/services/new_rta 的 APISecret" size="large" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large">
                    保存配置
                  </Button>
                  <Button onClick={handleXfyunClear} icon={<DeleteOutlined />} size="large">
                    清空配置
                  </Button>
                </Space>
              </Form.Item>
            </Form>

            <Divider />

            <div>
              <Text strong>配置状态：</Text>
              <Text type={xfyunConfig.isConfigured ? 'success' : 'warning'}>
                {xfyunConfig.isConfigured ? '已配置' : '未配置'}
              </Text>
            </div>

            {xfyunConfig.updatedAt && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  最后更新：{new Date(xfyunConfig.updatedAt).toLocaleString()}
                </Text>
              </div>
            )}
          </Card>
        </TabPane>

        <TabPane tab="DeepSeek AI" key="deepseek">
          <Card title="DeepSeek API">
            <Form
              form={deepseekForm}
              layout="vertical"
              onFinish={handleDeepSeekSave}
              initialValues={{
                apiKey: deepseekConfig?.apiKey || '',
                baseUrl: deepseekConfig?.baseUrl || 'https://api.deepseek.com',
                model: deepseekConfig?.model || 'deepseek-chat',
                maxTokens: deepseekConfig?.maxTokens || 2000,
                temperature: deepseekConfig?.temperature || 0.7,
              }}
            >
              <Form.Item
                label="API Key"
                name="apiKey"
                rules={[{ required: true, message: '请填写 DeepSeek API Key' }]}
              >
                <Input.Password placeholder="DeepSeek API Key" size="large" />
              </Form.Item>

              <Form.Item
                label="API Base URL"
                name="baseUrl"
                rules={[{ required: true, message: '请填写 API Base URL' }]}
              >
                <Input placeholder="https://api.deepseek.com" size="large" />
              </Form.Item>

              <Form.Item
                label="模型"
                name="model"
                rules={[{ required: true, message: '请填写模型名称' }]}
              >
                <Input placeholder="deepseek-chat" size="large" />
              </Form.Item>

              <Form.Item
                label="最大输出 Token"
                name="maxTokens"
                rules={[{ required: true, type: 'number', min: 1, max: 4000, message: '请输入 1 到 4000 之间的数字' }]}
              >
                <InputNumber placeholder="2000" style={{ width: '100%' }} size="large" min={1} max={4000} />
              </Form.Item>

              <Form.Item
                label="温度"
                name="temperature"
                rules={[{ required: true, type: 'number', min: 0, max: 2, message: '请输入 0 到 2 之间的数字' }]}
              >
                <InputNumber placeholder="0.7" style={{ width: '100%' }} size="large" min={0} max={2} step={0.1} />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large">
                  保存配置
                </Button>
              </Form.Item>
            </Form>

            <Divider />

            <div>
              <Text strong>配置状态：</Text>
              <Text type={deepseekConfig?.apiKey ? 'success' : 'warning'}>
                {deepseekConfig?.apiKey ? '已配置' : '未配置'}
              </Text>
            </div>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}
