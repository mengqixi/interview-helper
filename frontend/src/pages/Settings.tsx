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
    message.success('Xfyun config saved')
  }

  const handleXfyunClear = () => {
    clearXfyunConfig()
    xfyunForm.resetFields()
    message.success('Xfyun config cleared')
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
      message.success('DeepSeek config saved')
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <Title level={2}>Settings</Title>
      <Text type="secondary">Configure API keys and model parameters.</Text>

      <Divider />

      <Tabs defaultActiveKey="xfyun" type="card">
        <TabPane tab="Xfyun ASR" key="xfyun">
          <Card title="Xfyun realtime ASR large model">
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
                rules={[{ required: true, message: 'Please enter Xfyun APPID' }]}
              >
                <Input placeholder="APPID from console.xfyun.cn/services/new_rta" size="large" />
              </Form.Item>

              <Form.Item
                label="APIKey"
                name="apiKey"
                rules={[{ required: true, message: 'Please enter Xfyun APIKey' }]}
              >
                <Input.Password placeholder="APIKey from console.xfyun.cn/services/new_rta" size="large" />
              </Form.Item>

              <Form.Item
                label="APISecret"
                name="apiSecret"
                rules={[{ required: true, message: 'Please enter Xfyun APISecret' }]}
              >
                <Input.Password placeholder="APISecret from console.xfyun.cn/services/new_rta" size="large" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large">
                    Save config
                  </Button>
                  <Button onClick={handleXfyunClear} icon={<DeleteOutlined />} size="large">
                    Clear config
                  </Button>
                </Space>
              </Form.Item>
            </Form>

            <Divider />

            <div>
              <Text strong>Status: </Text>
              <Text type={xfyunConfig.isConfigured ? 'success' : 'warning'}>
                {xfyunConfig.isConfigured ? 'Configured' : 'Not configured'}
              </Text>
            </div>

            {xfyunConfig.updatedAt && (
              <div style={{ marginTop: 8 }}>
                <Text type="secondary">
                  Last updated: {new Date(xfyunConfig.updatedAt).toLocaleString()}
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
                rules={[{ required: true, message: 'Please enter DeepSeek API key' }]}
              >
                <Input.Password placeholder="DeepSeek API key" size="large" />
              </Form.Item>

              <Form.Item
                label="API Base URL"
                name="baseUrl"
                rules={[{ required: true, message: 'Please enter API base URL' }]}
              >
                <Input placeholder="https://api.deepseek.com" size="large" />
              </Form.Item>

              <Form.Item
                label="Model"
                name="model"
                rules={[{ required: true, message: 'Please enter model name' }]}
              >
                <Input placeholder="deepseek-chat" size="large" />
              </Form.Item>

              <Form.Item
                label="Max tokens"
                name="maxTokens"
                rules={[{ required: true, type: 'number', min: 1, max: 4000, message: 'Enter a number from 1 to 4000' }]}
              >
                <InputNumber placeholder="2000" style={{ width: '100%' }} size="large" min={1} max={4000} />
              </Form.Item>

              <Form.Item
                label="Temperature"
                name="temperature"
                rules={[{ required: true, type: 'number', min: 0, max: 2, message: 'Enter a number from 0 to 2' }]}
              >
                <InputNumber placeholder="0.7" style={{ width: '100%' }} size="large" min={0} max={2} step={0.1} />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" icon={<SaveOutlined />} size="large">
                  Save config
                </Button>
              </Form.Item>
            </Form>

            <Divider />

            <div>
              <Text strong>Status: </Text>
              <Text type={deepseekConfig?.apiKey ? 'success' : 'warning'}>
                {deepseekConfig?.apiKey ? 'Configured' : 'Not configured'}
              </Text>
            </div>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}
