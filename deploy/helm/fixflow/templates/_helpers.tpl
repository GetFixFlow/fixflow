{{/* The name every object starts with: the release name, with "fixflow" added unless it is in it already. Short, so that
     the longest suffix (-sidekiq-iot, -postgresql) stays inside Kubernetes' 63 characters. */}}
{{- define "fixflow.fullname" -}}
{{- if contains "fixflow" .Release.Name -}}
{{- .Release.Name | trunc 40 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-fixflow" .Release.Name | trunc 40 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "fixflow.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: fixflow
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{/* What picks out the pods of one part (the root context as "root", the part as "component"). Never changes for a Deployment. */}}
{{- define "fixflow.selectorLabels" -}}
app.kubernetes.io/name: fixflow
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{/* An image of FixFlow: the root context as "root", fixflow-api or fixflow-web as "name". */}}
{{- define "fixflow.image" -}}
{{- printf "%s/%s:%s" (trimSuffix "/" .root.Values.image.repository) .name (toString (default .root.Chart.AppVersion .root.Values.image.tag)) -}}
{{- end -}}

{{- define "fixflow.secretName" -}}
{{- default (printf "%s-secrets" (include "fixflow.fullname" .)) .Values.existingSecret -}}
{{- end -}}

{{/* The sensor broker the application connects to: the bundled one, or the one named in mqtt.external. Empty: no broker. */}}
{{- define "fixflow.mqttHost" -}}
{{- if .Values.mqtt.enabled -}}
{{- printf "%s-mqtt" (include "fixflow.fullname" .) -}}
{{- else -}}
{{- .Values.mqtt.external.host -}}
{{- end -}}
{{- end -}}

{{/* Stops an install or upgrade that cannot work, with a message that says what to set. Called from api.yaml. */}}
{{- define "fixflow.validate" -}}
{{- $v := .Values -}}
{{- if not $v.appUrl -}}{{- fail "appUrl is required: the address people open FixFlow at, for example --set appUrl=https://fixflow.example.com" -}}{{- end -}}
{{- if not (regexMatch "^https?://[^/]+$" $v.appUrl) -}}{{- fail (printf "appUrl is %q: it must look like https://fixflow.example.com, with no slash or path at the end" $v.appUrl) -}}{{- end -}}
{{- if not $v.existingSecret -}}
{{- range $key := list "secretKeyBase" "deviseJwtSecretKey" "s3AccessKey" "s3SecretKey" -}}
{{- if not (index $v.secrets $key) -}}{{- fail (printf "secrets.%s is required (or name a Secret of your own in existingSecret). See values.yaml." $key) -}}{{- end -}}
{{- end -}}
{{- if $v.postgresql.enabled -}}
{{- if not $v.secrets.dbPassword -}}{{- fail "secrets.dbPassword is required for the bundled database (openssl rand -hex 24)" -}}{{- end -}}
{{- if not (regexMatch "^[A-Za-z0-9]+$" (toString $v.secrets.dbPassword)) -}}{{- fail "secrets.dbPassword must be letters and digits only, because it is part of the database address (openssl rand -hex 24)" -}}{{- end -}}
{{- else if not $v.secrets.databaseUrl -}}{{- fail "postgresql.enabled is false, so secrets.databaseUrl is required: postgres://user:password@host:5432/dbname" -}}{{- end -}}
{{- if $v.redis.enabled -}}
{{- if not $v.secrets.redisPassword -}}{{- fail "secrets.redisPassword is required for the bundled Redis (openssl rand -hex 24)" -}}{{- end -}}
{{- if not (regexMatch "^[A-Za-z0-9]+$" (toString $v.secrets.redisPassword)) -}}{{- fail "secrets.redisPassword must be letters and digits only, because it is part of the Redis address (openssl rand -hex 24)" -}}{{- end -}}
{{- else if not $v.secrets.redisUrl -}}{{- fail "redis.enabled is false, so secrets.redisUrl is required: redis://:password@host:6379/0" -}}{{- end -}}
{{- if and (include "fixflow.mqttHost" .) (not $v.secrets.mqttPassword) -}}{{- fail "secrets.mqttPassword is required when there is a sensor broker (openssl rand -hex 24)" -}}{{- end -}}
{{- end -}}
{{- if and (not $v.s3.enabled) (not $v.storage.endpoint) -}}{{- fail "s3.enabled is false, so storage.endpoint is required: the address of your S3-compatible storage, such as https://s3.us-east-1.amazonaws.com" -}}{{- end -}}
{{- end -}}

{{/* The settings the application and the workers share (root context as "root"; "subscriber" is "true" for the one worker that
     listens to the sensor broker). Order matters: a later entry of the same name wins, so env (from the values) is last. */}}
{{- define "fixflow.env" -}}
{{- $v := .root.Values -}}
{{- $secret := include "fixflow.secretName" .root -}}
{{- $full := include "fixflow.fullname" .root -}}
- name: RAILS_ENV
  value: production
- name: APP_URL
  value: {{ $v.appUrl | quote }}
- name: ALLOWED_ORIGINS
  value: {{ default $v.appUrl $v.allowedOrigins | quote }}
- name: SECRET_KEY_BASE
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: SECRET_KEY_BASE } }
- name: DEVISE_JWT_SECRET_KEY
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: DEVISE_JWT_SECRET_KEY } }
{{- if $v.postgresql.enabled }}
- name: DB_PASSWORD
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: DB_PASSWORD } }
- name: DATABASE_URL
  value: {{ printf "postgres://fixflow:$(DB_PASSWORD)@%s-postgresql:5432/fixflow_production" $full | quote }}
{{- else }}
- name: DATABASE_URL
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: DATABASE_URL } }
{{- end }}
{{- if $v.redis.enabled }}
- name: REDIS_PASSWORD
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: REDIS_PASSWORD } }
- name: REDIS_URL
  value: {{ printf "redis://:$(REDIS_PASSWORD)@%s-redis:6379/0" $full | quote }}
{{- else }}
- name: REDIS_URL
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: REDIS_URL } }
{{- end }}
- name: MINIO_ENDPOINT
  value: {{ if $v.s3.enabled }}{{ printf "http://%s-s3:8333" $full | quote }}{{ else }}{{ $v.storage.endpoint | quote }}{{ end }}
- name: MINIO_ACCESS_KEY
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: MINIO_ACCESS_KEY } }
- name: MINIO_SECRET_KEY
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: MINIO_SECRET_KEY } }
- name: MINIO_REGION
  value: {{ $v.storage.region | quote }}
- name: MINIO_BUCKET
  value: {{ $v.storage.bucket | quote }}
- name: MINIO_BACKUP_BUCKET
  value: {{ $v.storage.backupBucket | quote }}
{{- if include "fixflow.mqttHost" .root }}
- name: MQTT_HOST
  value: {{ include "fixflow.mqttHost" .root | quote }}
- name: MQTT_PORT
  value: {{ ternary 1883 $v.mqtt.external.port $v.mqtt.enabled | quote }}
- name: MQTT_USERNAME
  value: {{ $v.mqtt.username | quote }}
- name: MQTT_PASSWORD
  valueFrom: { secretKeyRef: { name: {{ $secret }}, key: MQTT_PASSWORD } }
{{- end }}
- name: MQTT_SUBSCRIBER
  value: {{ .subscriber | quote }}
{{- range $name, $value := $v.env }}
- name: {{ $name }}
  value: {{ $value | quote }}
{{- end }}
{{- end -}}

{{/* The volume and mount for the plugins folder, when there is one. */}}
{{- define "fixflow.pluginsVolume" -}}
{{- if .Values.plugins.existingClaim }}
- name: plugins
  persistentVolumeClaim: { claimName: {{ .Values.plugins.existingClaim }}, readOnly: true }
{{- end }}
{{- end -}}

{{- define "fixflow.pluginsMount" -}}
{{- if .Values.plugins.existingClaim }}
- name: plugins
  mountPath: /app/plugins
  readOnly: true
{{- end }}
{{- end -}}

{{/* Where the pods of the application may run (root context as "root", the part as "component"). */}}
{{- define "fixflow.placement" -}}
{{- with .root.Values.nodeSelector }}
nodeSelector: {{ toYaml . | nindent 2 }}
{{- end }}
{{- with .root.Values.tolerations }}
tolerations: {{ toYaml . | nindent 2 }}
{{- end }}
{{- with .root.Values.affinity }}
affinity: {{ toYaml . | nindent 2 }}
{{- end }}
{{- if .root.Values.spread.enabled }}
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: ScheduleAnyway
    labelSelector:
      matchLabels: {{ include "fixflow.selectorLabels" . | nindent 8 }}
{{- end }}
{{- end -}}

{{- define "fixflow.imagePullSecrets" -}}
{{- with .Values.imagePullSecrets }}
imagePullSecrets: {{ toYaml . | nindent 2 }}
{{- end }}
{{- end -}}
