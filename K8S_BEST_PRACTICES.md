# 🎯 Kubernetes - Boas Práticas e Checklists

> Guia de boas práticas e checklists de implementação para componentes Kubernetes

---

## Índice

1. [StatefulSet](#1-statefulset)
2. [Probes (Health Checks)](#2-probes-health-checks)
3. [Secret](#3-secret)
4. [PersistentVolume (PV) e PersistentVolumeClaim (PVC)](#4-persistentvolume-pv-e-persistentvolumeclaim-pvc)
5. [HorizontalPodAutoscaler (HPA)](#5-horizontalpodautoscaler-hpa)
6. [Deploy Completo](#6-deploy-completo)

---

## 1. StatefulSet

### ⚙️ Boas Práticas

```yaml
# ✅ FAÇA
- Use Headless Service (clusterIP: None)
- Configure readinessProbe (ordem depende de ready)
- Use volumeClaimTemplates para storage
- Configure PodDisruptionBudget
- Implemente backup dos PVCs
- Use init containers para configuração

# ❌ NÃO FAÇA
- Usar para aplicações stateless
- Deletar PVCs sem backup
- Escalar rapidamente (respeite a ordem)
- Usar storage compartilhado entre Pods
- Ignorar ordem de inicialização
```

### 📋 Checklist de Implementação

```bash
# 1. Criar Headless Service
apiVersion: v1
kind: Service
metadata:
  name: mysql
spec:
  clusterIP: None
  selector:
    app: mysql
  ports:
    - port: 3306

# 2. Criar StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql
  replicas: 3
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi

# 3. Verificar criação sequencial
kubectl get pods -w
# Aguarde mysql-0 Ready antes de mysql-1

# 4. Testar DNS estável
kubectl run -it --rm debug --image=busybox -- nslookup mysql-0.mysql

# 5. Verificar PVCs criados
kubectl get pvc
# data-mysql-0, data-mysql-1, data-mysql-2
```

---

## 2. Probes (Health Checks)

### ⚙️ Boas Práticas

```yaml
# ✅ FAÇA
- Use Readiness em TODOS os Pods que recebem tráfego
- Liveness apenas se necessário (evita restart loops)
- initialDelaySeconds > tempo de startup da app
- periodSeconds: Readiness (5-10s), Liveness (10-30s)
- failureThreshold: 3 (padrão razoável)
- Endpoint /health leve e rápido (<1s)

# ❌ NÃO FAÇA
- Liveness muito agressivo (periodSeconds muito baixo)
- Readiness sem Liveness (Pod travado fica sem tráfego para sempre)
- Endpoint /health pesado (consultas ao DB)
- initialDelaySeconds muito baixo (falsos positivos)
- Usar mesmos valores para Liveness e Readiness
```

### 📋 Checklist de Implementação

```bash
# 1. Crie endpoint /health na aplicação
GET /health → 200 OK (saudável) ou 500 (problema)

# 2. Configure Readiness (essencial)
readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 2
  periodSeconds: 5

# 3. Configure Liveness (se necessário)
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  failureThreshold: 3

# 4. Teste as probes
kubectl describe pod <pod-name>
# Verifique eventos: Readiness/Liveness probe failed

# 5. Monitore restarts
kubectl get pods
# RESTARTS deve ser 0 ou baixo
```

### 🎯 Valores Recomendados por Tipo de Aplicação

```yaml
# Aplicação Web (Node.js, Python, Ruby)
readinessProbe:
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3

livenessProbe:
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

# Aplicação Java (Spring Boot)
readinessProbe:
  initialDelaySeconds: 30  # JVM startup lento
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

livenessProbe:
  initialDelaySeconds: 60  # JVM startup lento
  periodSeconds: 15
  timeoutSeconds: 5
  failureThreshold: 3

# Banco de Dados (MySQL, PostgreSQL)
readinessProbe:
  initialDelaySeconds: 10
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

livenessProbe:
  initialDelaySeconds: 60
  periodSeconds: 30
  timeoutSeconds: 10
  failureThreshold: 5  # Mais tolerante
```

---

## 3. Secret

### 🔒 Boas Práticas de Segurança

```bash
# ✅ FAÇA
- Use RBAC para limitar acesso a Secrets
- Habilite encryption at rest no etcd
- Use ferramentas externas (Vault, Sealed Secrets)
- Rotacione Secrets regularmente
- Use stringData (converte automaticamente para base64)
- Limite Secrets por namespace
- Use imagePullSecrets para registries privados

# ❌ NÃO FAÇA
- Commitar Secrets no Git
- Logar valores de Secrets
- Expor Secrets em respostas HTTP
- Usar Secrets para dados não-sensíveis
```

### 📋 Checklist de Implementação

```bash
# 1. Criar Secret via kubectl
kubectl create secret generic my-secret \
  --from-literal=password=s3cr3t \
  --from-file=ssh-key=~/.ssh/id_rsa

# 2. Ou via YAML (use stringData)
apiVersion: v1
kind: Secret
metadata:
  name: my-secret
type: Opaque
stringData:
  password: s3cr3t
  api-key: abc123

# 3. Verificar Secret criado
kubectl get secret my-secret
kubectl describe secret my-secret

# 4. Usar no Pod
env:
  - name: PASSWORD
    valueFrom:
      secretKeyRef:
        name: my-secret
        key: password

# 5. Testar no Pod
kubectl exec <pod> -- env | grep PASSWORD
```

### 🔐 Ferramentas Recomendadas

```bash
# Sealed Secrets (Bitnami)
# Criptografa Secrets para commit no Git
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.18.0/controller.yaml

# External Secrets Operator
# Sincroniza com Vault, AWS Secrets Manager, etc.
helm install external-secrets external-secrets/external-secrets

# SOPS (Mozilla)
# Criptografa arquivos YAML com chaves KMS
sops -e secret.yaml > secret.enc.yaml
```

---

## 4. PersistentVolume (PV) e PersistentVolumeClaim (PVC)

### ⚙️ Boas Práticas

```yaml
# ✅ FAÇA
- Use StorageClass para provisionamento dinâmico
- Configure backups regulares dos PVs
- Use Retain policy em produção
- Monitore uso de storage
- Configure limites de storage por namespace
- Use ReadWriteOnce quando possível (melhor performance)
- Teste restore de backups regularmente

# ❌ NÃO FAÇA
- Usar hostPath em produção
- Deletar PVCs sem backup
- Compartilhar PVC entre Deployments (use StatefulSet)
- Ignorar limites de storage
- Usar Delete policy sem backup
- Assumir que todos storages suportam RWX
```

### 📋 Checklist de Implementação

```bash
# 1. Verificar StorageClass disponível
kubectl get sc

# 2. Criar PVC
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: my-pvc
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 10Gi

# 3. Verificar bind
kubectl get pvc my-pvc
# STATUS deve ser Bound

# 4. Usar no Pod/Deployment
volumes:
  - name: storage
    persistentVolumeClaim:
      claimName: my-pvc

# 5. Testar persistência
kubectl exec -it <pod> -- sh -c "echo test > /mnt/data/file.txt"
kubectl delete pod <pod>
# Novo pod deve ter o arquivo
```

### 💾 Estratégias de Backup

```bash
# Velero (backup completo do cluster)
velero install --provider aws --bucket my-backup-bucket

# Backup de PVC específico
velero backup create my-backup --include-resources pvc,pv

# Restore
velero restore create --from-backup my-backup

# Snapshot de PV (AWS EBS)
kubectl apply -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: my-snapshot
spec:
  volumeSnapshotClassName: csi-aws-vsc
  source:
    persistentVolumeClaimName: my-pvc
EOF

# Verificar snapshot
kubectl get volumesnapshot
```

---

## 5. HorizontalPodAutoscaler (HPA)

### 🎯 Boas Práticas

```yaml
# ✅ FAÇA
- Defina minReplicas >= 2 (alta disponibilidade)
- Configure requests/limits adequados
- Use múltiplas métricas (CPU + memória)
- Configure PodDisruptionBudget
- Monitore métricas customizadas
- Teste carga antes de produção
- Configure cooldown adequado

# ❌ NÃO FAÇA
- minReplicas = 1 (sem redundância)
- Sem resources definidos
- Alvos muito agressivos (ex: 90% CPU)
- Esquecer cooldown (flapping)
- HPA + escala manual simultânea
```

### 📋 Checklist de Implementação

```bash
# 1. Verificar metrics-server instalado
kubectl get deployment metrics-server -n kube-system

# 2. Configurar resources no Deployment
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

# 3. Criar HPA
kubectl autoscale deployment my-app \
  --cpu-percent=50 \
  --min=2 \
  --max=10

# Ou via YAML
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50

# 4. Verificar HPA
kubectl get hpa
kubectl describe hpa my-app

# 5. Testar autoscaling
# Gerar carga
kubectl run -it --rm load-generator --image=busybox -- /bin/sh -c "while true; do wget -q -O- http://my-app; done"

# Monitorar escala
kubectl get hpa -w
```

### 📊 Valores Recomendados

```yaml
# Aplicação Web (tráfego variável)
minReplicas: 3
maxReplicas: 20
targetCPUUtilizationPercentage: 60
targetMemoryUtilizationPercentage: 70

# API Backend (tráfego previsível)
minReplicas: 2
maxReplicas: 10
targetCPUUtilizationPercentage: 70

# Worker/Job Processor (carga em lote)
minReplicas: 1
maxReplicas: 50
targetCPUUtilizationPercentage: 80

# Microserviço Crítico
minReplicas: 5
maxReplicas: 30
targetCPUUtilizationPercentage: 50
```

---

## 6. Deploy Completo

### 📋 Checklist de Deploy Completo

```bash
# 1. Configuração
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 2. Workload
kubectl apply -f k8s/deployment.yaml

# 3. Rede
kubectl apply -f k8s/service.yaml

# 4. Métricas (se necessário)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 5. Autoscaling
kubectl apply -f k8s/hpa.yaml

# 6. Verificação
kubectl get all -l app=demo-app
kubectl get cm,secret
kubectl get hpa
```

### 🔍 Verificação Pós-Deploy

```bash
# 1. Verificar Pods rodando
kubectl get pods
# STATUS deve ser Running

# 2. Verificar logs
kubectl logs -f deployment/my-app

# 3. Verificar Service
kubectl get svc my-app
kubectl get endpoints my-app

# 4. Testar conectividade
kubectl run test --rm -it --image=busybox -- wget -qO- http://my-app

# 5. Verificar Probes
kubectl describe pod <pod-name> | grep -A 5 "Liveness\|Readiness"

# 6. Verificar HPA
kubectl get hpa
# TARGETS deve mostrar métricas (ex: 20%/50%)

# 7. Verificar eventos
kubectl get events --sort-by='.lastTimestamp'
```

### 🚨 Troubleshooting Comum

```bash
# Pod em CrashLoopBackOff
kubectl logs <pod-name> --previous
kubectl describe pod <pod-name>

# Service não responde
kubectl get endpoints <service-name>
# Verificar se há endpoints

# HPA não escala
kubectl describe hpa <hpa-name>
# Verificar se metrics-server está funcionando
kubectl top pods

# PVC em Pending
kubectl describe pvc <pvc-name>
# Verificar se há StorageClass disponível

# Secret não encontrado
kubectl get secret <secret-name>
kubectl describe pod <pod-name> | grep -A 5 "Events"
```

---

## 🎓 Resumo de Boas Práticas Gerais

### 🔒 Segurança
- Use RBAC para controle de acesso
- Criptografe Secrets at rest
- Não exponha portas desnecessárias
- Use NetworkPolicies
- Escaneie imagens por vulnerabilidades

### 📊 Observabilidade
- Configure logs centralizados
- Use Prometheus + Grafana
- Configure alertas
- Monitore recursos (CPU, memória, storage)
- Use tracing distribuído (Jaeger, Zipkin)

### 🚀 Performance
- Configure resources (requests/limits)
- Use HPA para autoscaling
- Configure PodDisruptionBudget
- Use readiness/liveness probes
- Otimize imagens Docker

### 💾 Storage
- Use StorageClass dinâmico
- Configure backups regulares
- Monitore uso de storage
- Use Retain policy em produção
- Teste restore regularmente

### 🔄 CI/CD
- Use GitOps (ArgoCD, Flux)
- Automatize testes
- Use ambientes separados (dev, staging, prod)
- Implemente rollback automático
- Use canary/blue-green deployments

---

## 📚 Recursos Adicionais

- [Kubernetes Best Practices (Google)](https://cloud.google.com/architecture/best-practices-for-running-kubernetes)
- [Production Best Practices (Kubernetes Docs)](https://kubernetes.io/docs/setup/best-practices/)
- [12 Factor App](https://12factor.net/)
- [CNCF Landscape](https://landscape.cncf.io/)
