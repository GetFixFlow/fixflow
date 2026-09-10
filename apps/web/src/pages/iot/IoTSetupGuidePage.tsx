import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Key, Radio, Zap, TestTube } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { CodeSnippet } from '@/components/iot/CodeSnippet'
import { cn } from '@/lib/utils'

const CURL_EXAMPLE = `curl -X POST https://your-domain/api/v1/iot/ingest \\
  -H "X-API-Key: YOUR_API_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{"asset_id": "FF-000001", "metric": "temperature", "value": 72.4, "unit": "celsius"}'`

const PYTHON_EXAMPLE = `import requests

API_KEY = "YOUR_API_KEY_HERE"
BASE_URL = "https://your-domain/api/v1"

def send_reading(asset_id, metric, value, unit):
    response = requests.post(
        f"{BASE_URL}/iot/ingest",
        headers={"X-API-Key": API_KEY},
        json={"asset_id": asset_id, "metric": metric, "value": value, "unit": unit}
    )
    return response.json()

send_reading("FF-000001", "temperature", 72.4, "celsius")`

const NODE_EXAMPLE = `const API_KEY = "YOUR_API_KEY_HERE";
const BASE_URL = "https://your-domain/api/v1";

async function sendReading(assetId, metric, value, unit) {
  const response = await fetch(\`\${BASE_URL}/iot/ingest\`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ asset_id: assetId, metric, value, unit }),
  });
  return response.json();
}

sendReading("FF-000001", "temperature", 72.4, "celsius");`

const ARDUINO_EXAMPLE = `#include <WiFi.h>
#include <HTTPClient.h>

const char* apiKey = "YOUR_API_KEY_HERE";
const char* ingestUrl = "https://your-domain/api/v1/iot/ingest";

void sendReading(const char* assetId, const char* metric, float value, const char* unit) {
  HTTPClient http;
  http.begin(ingestUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", apiKey);

  String payload = "{";
  payload += "\\"asset_id\\":\\"" + String(assetId) + "\\",";
  payload += "\\"metric\\":\\"" + String(metric) + "\\",";
  payload += "\\"value\\":" + String(value) + ",";
  payload += "\\"unit\\":\\"" + String(unit) + "\\"";
  payload += "}";

  int code = http.POST(payload);
  http.end();
}`

const MQTT_EXAMPLE = `# MQTT Broker: mqtt.your-domain.com:1883
# Topic format: fixflow/{org_token}/assets/{asset_id}/telemetry
# Authentication: username = api_key, password = YOUR_API_KEY_HERE

# Python MQTT example
import paho.mqtt.client as mqtt
import json

client = mqtt.Client()
client.username_pw_set("api_key", "YOUR_API_KEY_HERE")
client.connect("mqtt.your-domain.com", 1883)

payload = json.dumps({
    "metric": "temperature",
    "value": 72.4,
    "unit": "celsius",
    "timestamp": "2026-06-22T10:00:00Z"
})

client.publish(
    "fixflow/YOUR_ORG_TOKEN/assets/FF-000001/telemetry",
    payload
)`

type CodeTab = 'curl' | 'python' | 'nodejs' | 'arduino'
type SendTab = 'rest' | 'mqtt'

const STEPS = [
  {
    num: 1,
    icon: Key,
    title: 'Create API Key',
    description: 'Generate an API key to authenticate your IoT devices with FixFlow.',
    action: <Link to="/settings/api-keys"><Button>Go to API Keys →</Button></Link>,
  },
  {
    num: 2,
    icon: Radio,
    title: 'Send First Reading',
    description: 'Use the REST API or MQTT to send sensor data from your device.',
    custom: true,
  },
  {
    num: 3,
    icon: Zap,
    title: 'Create Alert Rule',
    description: 'Set up rules to trigger alerts when readings exceed thresholds.',
    action: <Link to="/iot/rules/new"><Button>Create Your First Rule →</Button></Link>,
  },
  {
    num: 4,
    icon: TestTube,
    title: 'Test It All Together',
    description: 'Use the rule test tool to verify your setup is working correctly.',
    action: <Link to="/iot/rules"><Button variant="outline">Open Test Tool →</Button></Link>,
  },
]

export function IoTSetupGuidePage() {
  const [codeTab, setCodeTab] = useState<CodeTab>('curl')
  const [sendTab, setSendTab] = useState<SendTab>('rest')

  const codeMap: Record<CodeTab, string> = {
    curl: CURL_EXAMPLE,
    python: PYTHON_EXAMPLE,
    nodejs: NODE_EXAMPLE,
    arduino: ARDUINO_EXAMPLE,
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Connect Your First IoT Device</h1>
        <p className="text-sm text-gray-500 mt-1">Follow these steps to start sending sensor data to FixFlow.</p>
      </div>

      {/* Vertical stepper */}
      <div className="space-y-4">
        {STEPS.map((step, i) => (
          <Card key={step.num}>
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                {/* Step number */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white text-sm font-bold">
                  {step.num}
                </div>

                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <step.icon className="h-4 w-4 text-brand-600" />
                    <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{step.title}</h2>
                  </div>
                  <p className="text-sm text-gray-500">{step.description}</p>

                  {step.custom ? (
                    // Step 2 with tabs
                    <div className="space-y-3">
                      {/* Protocol tabs */}
                      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
                        {(['rest', 'mqtt'] as SendTab[]).map((t) => (
                          <button
                            key={t}
                            onClick={() => setSendTab(t)}
                            className={cn(
                              'px-3 py-1.5 text-sm font-medium border-b-2 transition-colors uppercase',
                              sendTab === t
                                ? 'border-brand-600 text-brand-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700',
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      {sendTab === 'rest' && (
                        <div className="space-y-3">
                          {/* Language tabs */}
                          <div className="flex gap-1 flex-wrap">
                            {(['curl', 'python', 'nodejs', 'arduino'] as CodeTab[]).map((t) => (
                              <button
                                key={t}
                                onClick={() => setCodeTab(t)}
                                className={cn(
                                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                                  codeTab === t
                                    ? 'bg-brand-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200',
                                )}
                              >
                                {t === 'nodejs' ? 'Node.js' : t.charAt(0).toUpperCase() + t.slice(1)}
                              </button>
                            ))}
                          </div>
                          <CodeSnippet
                            code={codeMap[codeTab]}
                            language={codeTab === 'curl' ? 'bash' : codeTab === 'nodejs' ? 'javascript' : codeTab}
                          />
                        </div>
                      )}

                      {sendTab === 'mqtt' && (
                        <CodeSnippet code={MQTT_EXAMPLE} language="python" filename="MQTT Setup" />
                      )}
                    </div>
                  ) : step.action}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data schema reference */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Payload Schema</h2>
          <CodeSnippet
            code={JSON.stringify({
              asset_id: "FF-000001",
              metric: "temperature",
              value: 72.4,
              unit: "celsius",
              device_id: "sensor-001",
              timestamp: "2026-06-22T10:00:00Z",
              metadata: { location: "room-4a" },
            }, null, 2)}
            language="json"
            filename="POST /api/v1/iot/ingest"
          />
          <div className="mt-3 space-y-1 text-xs text-gray-500">
            <p><span className="font-medium text-gray-700 dark:text-gray-300">asset_id</span> — Your asset tag (e.g. FF-000001) or numeric ID. Required.</p>
            <p><span className="font-medium text-gray-700 dark:text-gray-300">metric</span> — Sensor metric name. Required.</p>
            <p><span className="font-medium text-gray-700 dark:text-gray-300">value</span> — Numeric reading. Required.</p>
            <p><span className="font-medium text-gray-700 dark:text-gray-300">unit</span> — Unit of measurement. Optional but recommended.</p>
            <p><span className="font-medium text-gray-700 dark:text-gray-300">timestamp</span> — ISO 8601. Defaults to server time if omitted.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
