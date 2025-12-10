# Componentes Kubernetes: Guia Conceitual

Este documento explica os principais componentes do Kubernetes com exemplos práticos baseados neste projeto.

> 📚 **Para boas práticas e checklists de implementação**, consulte: [K8S_BEST_PRACTICES.md](./K8S_BEST_PRACTICES.md)

---

## 📋 Índice
1. [Pod](#1-pod)
2. [Deployment](#2-deployment)
3. [StatefulSet](#3-statefulset)
4. [Probes (Health Checks)](#4-probes-health-checks)
5. [Service](#5-service)
6. [ConfigMap](#6-configmap)
7. [Secret](#7-secret)
8. [PersistentVolume (PV) e PersistentVolumeClaim (PVC)](#8-persistentvolume-pv-e-persistentvolumeclaim-pvc)
9. [HorizontalPodAutoscaler (HPA)](#9-horizontalpodautoscaler-hpa)
10. [Comparação entre Componentes](#10-comparação-entre-componentes)

---

## 1. Pod

### 🎯 Conceito
O **Pod** é a menor unidade executável no Kubernetes. Representa um ou mais containers que compartilham:
- Namespace de rede (mesmo IP)
- Volumes de armazenamento
- Contexto de execução

### 🔑 Características
- **Efêmero**: Pods podem ser criados/destruídos a qualquer momento
- **Imutável**: Não se atualiza um Pod, cria-se um novo
- **Endereço IP único**: Cada Pod recebe um IP interno do cluster
- **Compartilhamento**: Containers no mesmo Pod compartilham localhost

### 📦 Exemplo Prático (deste projeto)
```yaml
# Pod criado automaticamente pelo Deployment
metadata:
  labels:
    app: demo-app
spec:
  containers:
    - name: demo-app
      image: demo-app:local
      ports:
        - containerPort: 8080
      resources:
        requests:
          cpu: "50m"
          memory: "64Mi"
        limits:
          cpu: "250m"
          memory: "128Mi"
```

### 🔍 Comandos Úteis
```bash
# Listar pods
kubectl get pods -l app=demo-app

# Detalhes de um pod
kubectl describe pod <pod-name>

# Logs de um pod
kubectl logs <pod-name>

# Executar comando dentro do pod
kubectl exec -it <pod-name> -- /bin/sh
```

### ⚠️ Quando NÃO usar diretamente
- **Nunca** crie Pods diretamente em produção
- Use **Deployments** ou **StatefulSets** para gerenciar Pods
- Pods diretos não têm auto-recuperação

---

## 2. Deployment

### 🎯 Conceito
O **Deployment** é um controlador que gerencia ReplicaSets e Pods, garantindo:
- Número desejado de réplicas
- Estratégias de atualização (rolling update)
- Rollback automático em caso de falha
- Auto-recuperação (self-healing)

### 🔑 Características
- **Declarativo**: Você declara o estado desejado, o Kubernetes garante
- **Rolling Updates**: Atualiza Pods gradualmente sem downtime
- **Rollback**: Pode reverter para versões anteriores
- **Escalabilidade**: Ajusta número de réplicas facilmente

### 📦 Exemplo Prático (deste projeto)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-app
spec:
  replicas: 2                    # Estado desejado: 2 Pods
  selector:
    matchLabels:
      app: demo-app               # Seleciona Pods com este label
  template:                       # Template do Pod
    metadata:
      labels:
        app: demo-app
    spec:
      containers:
        - name: demo-app
          image: demo-app:local
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: demo-config
            - secretRef:
                name: demo-secret
          resources:
            requests:
              cpu: "50m"
              memory: "64Mi"
            limits:
              cpu: "250m"
              memory: "128Mi"
          readinessProbe:         # Verifica se está pronto para receber tráfego
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 2
            periodSeconds: 5
          livenessProbe:          # Verifica se está saudável
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
```

### 🔍 Comandos Úteis
```bash
# Listar deployments
kubectl get deployments

# Escalar manualmente
kubectl scale deployment demo-app --replicas=3

# Atualizar imagem
kubectl set image deployment/demo-app demo-app=demo-app:v2

# Ver status do rollout
kubectl rollout status deployment/demo-app

# Histórico de rollouts
kubectl rollout history deployment/demo-app

# Reverter para versão anterior
kubectl rollout undo deployment/demo-app
```

### 🆚 Deployment vs Pod Direto

| Aspecto | Pod Direto | Deployment |
|---------|-----------|------------|
| **Auto-recuperação** | ❌ Não | ✅ Sim |
| **Escalabilidade** | ❌ Manual | ✅ Automática |
| **Rolling Updates** | ❌ Não | ✅ Sim |
| **Rollback** | ❌ Não | ✅ Sim |
| **Uso em Produção** | ❌ Evitar | ✅ Recomendado |

---

## 3. StatefulSet

### 🎯 Conceito
O **StatefulSet** é um controlador para aplicações **stateful** (com estado), garantindo:
- **Identidade estável**: Cada Pod tem nome previsível e persistente
- **Ordem de criação/exclusão**: Pods são criados/deletados em ordem sequencial
- **Storage persistente**: Cada Pod tem seu próprio volume persistente
- **DNS estável**: Cada Pod tem hostname único e previsível

### 🔑 Características
- **Identidade persistente**: Pod `mysql-0`, `mysql-1`, `mysql-2` (nomes fixos)
- **Ordem garantida**: Pods iniciam/terminam em ordem (0 → 1 → 2)
- **Storage dedicado**: Cada Pod tem seu próprio PVC
- **Network identity**: Hostname estável para cada Pod

### 🆚 StatefulSet vs Deployment

| Aspecto | Deployment | StatefulSet |
|---------|-----------|-------------|
| **Tipo de App** | Stateless | Stateful |
| **Nome dos Pods** | Aleatório (hash) | Previsível (ordinal) |
| **Ordem de criação** | Paralela | Sequencial |
| **Storage** | Compartilhado ou efêmero | Persistente por Pod |
| **Network Identity** | Efêmero | Estável |
| **Uso típico** | APIs, Web apps | Bancos, Kafka, Redis |

### 📦 Exemplo Prático: MySQL StatefulSet

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mysql
spec:
  clusterIP: None          # Headless Service (sem ClusterIP)
  selector:
    app: mysql
  ports:
    - port: 3306
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql       # Headless Service para DNS estável
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          ports:
            - containerPort: 3306
          env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mysql-secret
                  key: password
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
  volumeClaimTemplates:    # Template de PVC para cada Pod
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

### 🔧 Como Funciona

#### Nomes dos Pods (Previsíveis)
```bash
# Deployment (aleatório)
demo-app-7d8f9c5b4-x7k2m
demo-app-7d8f9c5b4-9p3qr

# StatefulSet (ordinal)
mysql-0
mysql-1
mysql-2
```

#### DNS Estável (Headless Service)
```bash
# Cada Pod tem DNS único
mysql-0.mysql.default.svc.cluster.local
mysql-1.mysql.default.svc.cluster.local
mysql-2.mysql.default.svc.cluster.local

# Aplicação pode conectar diretamente ao Pod específico
mysql -h mysql-0.mysql.default.svc.cluster.local
```

#### Storage Persistente por Pod
```
┌─────────────────────────────────────────┐
│         StatefulSet: mysql              │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  │ mysql-0  │  │ mysql-1  │  │ mysql-2  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘
│       │             │             │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐
│  │ PVC-0    │  │ PVC-1    │  │ PVC-2    │
│  │ 10Gi     │  │ 10Gi     │  │ 10Gi     │
│  └──────────┘  └──────────┘  └──────────┘
└─────────────────────────────────────────┘
```

### 📊 Ordem de Criação/Exclusão

**Scale Up (0 → 3)**:
```
1. Cria mysql-0 → Aguarda Ready
2. Cria mysql-1 → Aguarda Ready (após mysql-0)
3. Cria mysql-2 → Aguarda Ready (após mysql-1)
```

**Scale Down (3 → 1)**:
```
1. Deleta mysql-2 (ordem reversa)
2. Deleta mysql-1 (após mysql-2 deletado)
3. mysql-0 permanece
```

### 🎯 Casos de Uso

#### ✅ Quando usar StatefulSet
- **Bancos de dados**: MySQL, PostgreSQL, MongoDB
- **Message queues**: Kafka, RabbitMQ, NATS
- **Cache distribuído**: Redis Cluster, Memcached
- **Sistemas de coordenação**: ZooKeeper, etcd, Consul
- **Aplicações que precisam de**:
  - Identidade de rede estável
  - Storage persistente por instância
  - Ordem de inicialização/terminação

#### ❌ Quando NÃO usar StatefulSet
- APIs REST stateless
- Web servers (Nginx, Apache)
- Workers de processamento
- Aplicações que não mantêm estado local

### 🔍 Comandos Úteis

```bash
# Listar StatefulSets
kubectl get statefulsets
kubectl get sts

# Ver detalhes
kubectl describe sts mysql

# Ver Pods (ordem ordinal)
kubectl get pods -l app=mysql
# mysql-0   1/1     Running
# mysql-1   1/1     Running
# mysql-2   1/1     Running

# Escalar
kubectl scale sts mysql --replicas=5

# Ver PVCs criados automaticamente
kubectl get pvc
# data-mysql-0   Bound    10Gi
# data-mysql-1   Bound    10Gi
# data-mysql-2   Bound    10Gi

# Deletar StatefulSet (mantém PVCs)
kubectl delete sts mysql

# Deletar StatefulSet E PVCs
kubectl delete sts mysql
kubectl delete pvc -l app=mysql

# Conectar a Pod específico
kubectl exec -it mysql-0 -- mysql -u root -p

# Ver logs de Pod específico
kubectl logs mysql-1
```

### 🎯 Exemplo: MySQL Master-Slave

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: mysql
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      initContainers:
        - name: init-mysql
          image: mysql:8.0
          command:
            - bash
            - "-c"
            - |
              set -ex
              # mysql-0 = master, mysql-1+ = slaves
              [[ $(hostname) =~ -([0-9]+)$ ]] || exit 1
              ordinal=${BASH_REMATCH[1]}
              if [[ $ordinal -eq 0 ]]; then
                echo "Configurando como MASTER"
                cp /mnt/config-map/master.cnf /mnt/conf.d/
              else
                echo "Configurando como SLAVE"
                cp /mnt/config-map/slave.cnf /mnt/conf.d/
              fi
          volumeMounts:
            - name: conf
              mountPath: /mnt/conf.d
            - name: config-map
              mountPath: /mnt/config-map
      containers:
        - name: mysql
          image: mysql:8.0
          ports:
            - containerPort: 3306
          volumeMounts:
            - name: data
              mountPath: /var/lib/mysql
            - name: conf
              mountPath: /etc/mysql/conf.d
      volumes:
        - name: conf
          emptyDir: {}
        - name: config-map
          configMap:
            name: mysql-config
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

### 🔒 Garantias do StatefulSet

```bash
# 1. Identidade Estável
Pod deletado → Recriado com MESMO nome
mysql-1 deletado → mysql-1 recriado (não mysql-1-xyz)

# 2. Storage Persistente
Pod deletado → PVC PERMANECE
Pod recriado → Conecta ao MESMO PVC

# 3. Ordem Sequencial
Scale up: 0 → 1 → 2 (aguarda cada um ficar ready)
Scale down: 2 → 1 → 0 (ordem reversa)

# 4. DNS Estável
Pod recriado → MESMO hostname DNS
mysql-1.mysql.default.svc.cluster.local (sempre)
```

### 🎓 Resumo Rápido

| Aspecto | Valor |
|---------|-------|
| **Quando usar** | Apps stateful (DB, Kafka, Redis) |
| **Nome dos Pods** | Previsível (mysql-0, mysql-1) |
| **Storage** | Persistente por Pod (PVC dedicado) |
| **Ordem** | Sequencial (0 → 1 → 2) |
| **DNS** | Estável (pod.service.namespace.svc) |
| **Complexidade** | Alta (use apenas se necessário) |

---

## 4. Probes (Health Checks)

### 🎯 Conceito
**Probes** são verificações de saúde que o Kubernetes executa periodicamente nos containers para determinar seu estado. Existem **3 tipos** de probes, cada um com uma responsabilidade específica.

### 🔑 Tipos de Probes

#### 3.1 Liveness Probe (Está Vivo?)
**Pergunta**: "O container está travado ou em deadlock?"

- **Propósito**: Detectar se o container está em um estado irrecuperável
- **Ação em falha**: **Reinicia o container**
- **Quando usar**: Detectar deadlocks, travamentos, processos zumbis
- **Exemplo**: Aplicação travou em loop infinito

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 5    # Aguarda 5s após o start
  periodSeconds: 10         # Verifica a cada 10s
  timeoutSeconds: 1         # Timeout de 1s
  failureThreshold: 3       # Reinicia após 3 falhas consecutivas
```

**Cenário Real**:
```
Container inicia → Aguarda 5s → Verifica /health a cada 10s
✅ /health retorna 200 → Container OK
❌ /health falha 3x seguidas → Kubernetes REINICIA o container
```

#### 3.2 Readiness Probe (Está Pronto?)
**Pergunta**: "O container está pronto para receber tráfego?"

- **Propósito**: Determinar se o Pod deve receber requisições
- **Ação em falha**: **Remove do Service** (não recebe tráfego)
- **Quando usar**: Aquecimento de cache, conexão com DB, carregamento de dados
- **Exemplo**: Aplicação iniciando, conectando ao banco

```yaml
readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 2    # Aguarda 2s após o start
  periodSeconds: 5          # Verifica a cada 5s
  timeoutSeconds: 1         # Timeout de 1s
  failureThreshold: 3       # Remove do Service após 3 falhas
```

**Cenário Real**:
```
Container inicia → Aguarda 2s → Verifica /health a cada 5s
✅ /health retorna 200 → Pod recebe tráfego do Service
❌ /health falha → Pod NÃO recebe tráfego (mas não reinicia)
✅ /health volta a funcionar → Pod volta a receber tráfego
```

#### 3.3 Startup Probe (Já Iniciou?)
**Pergunta**: "O container já terminou de inicializar?"

- **Propósito**: Dar tempo extra para containers com inicialização lenta
- **Ação em falha**: **Reinicia o container** (se não iniciar a tempo)
- **Quando usar**: Aplicações legadas, inicialização muito lenta (>30s)
- **Exemplo**: Aplicação Java com startup de 2 minutos

```yaml
startupProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 0
  periodSeconds: 10
  failureThreshold: 30      # 30 * 10s = 5 minutos para iniciar
```

**Cenário Real**:
```
Container inicia → Verifica /health a cada 10s
❌ Pode falhar até 30x (5 minutos total)
✅ Quando /health retorna 200 → Startup OK
→ Liveness e Readiness começam a funcionar
❌ Se falhar 30x → Kubernetes REINICIA o container
```

### 🆚 Comparação entre Probes

| Aspecto | Liveness | Readiness | Startup |
|---------|----------|-----------|---------|
| **Pergunta** | Está vivo? | Está pronto? | Já iniciou? |
| **Falha → Ação** | Reinicia container | Remove do Service | Reinicia container |
| **Quando verifica** | Durante toda vida | Durante toda vida | Apenas no início |
| **Bloqueia outros** | Não | Não | Sim (bloqueia Liveness/Readiness) |
| **Uso típico** | Detectar deadlock | Controlar tráfego | Apps com startup lento |
| **Obrigatório?** | ⚠️ Recomendado | ✅ Essencial | ⚙️ Opcional |

### 📦 Exemplo Completo (deste projeto)

```yaml
spec:
  containers:
    - name: demo-app
      image: demo-app:local
      ports:
        - containerPort: 8080
      
      # 1. Readiness: Controla se recebe tráfego
      readinessProbe:
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 2
        periodSeconds: 5
        timeoutSeconds: 1
        failureThreshold: 3
      
      # 2. Liveness: Detecta se travou
      livenessProbe:
        httpGet:
          path: /health
          port: 8080
        initialDelaySeconds: 5
        periodSeconds: 10
        timeoutSeconds: 1
        failureThreshold: 3
```

### 🔧 Tipos de Verificação

#### HTTP GET (usado neste projeto)
```yaml
httpGet:
  path: /health
  port: 8080
  httpHeaders:
    - name: Custom-Header
      value: Awesome
```

#### TCP Socket
```yaml
tcpSocket:
  port: 8080
```

#### Exec (comando)
```yaml
exec:
  command:
    - cat
    - /tmp/healthy
```

### 📊 Fluxo de Vida do Pod com Probes

**1. Inicialização**:
```
Pod criado → Startup Probe (se configurado) → Running
```

**2. Readiness Check**:
```
Readiness OK → Adicionado ao Service → Recebe tráfego
Readiness Falha → Removido do Service → NÃO recebe tráfego
```

**3. Liveness Check (contínuo)**:
```
Liveness OK → Pod continua rodando
Liveness Falha 3x → Kubernetes REINICIA o container
```

**4. Cenário: DB Desconectou**:
```
DB desconecta → Readiness falha → Pod removido do Service
DB reconecta → Readiness OK → Pod volta a receber tráfego
```

### 🎯 Cenários Práticos

#### Cenário 1: Aplicação Travou (Liveness)
```
Situação: Aplicação entrou em deadlock
Probe: Liveness falha 3x consecutivas
Ação: Kubernetes REINICIA o container
Resultado: Aplicação volta a funcionar
```

#### Cenário 2: Banco Desconectou (Readiness)
```
Situação: Conexão com banco de dados perdida
Probe: Readiness falha
Ação: Pod REMOVIDO do Service (não recebe tráfego)
Resultado: Requisições vão apenas para Pods saudáveis
Quando: Conexão volta → Readiness OK → Pod volta a receber tráfego
```

#### Cenário 3: Deploy com Rolling Update
```
1. Novo Pod criado (v2)
2. Readiness Probe verifica se está pronto
3. ❌ Ainda não pronto → Não recebe tráfego
4. ✅ Pronto → Começa a receber tráfego
5. Pod antigo (v1) é terminado
Resultado: Zero downtime
```

#### Cenário 4: Startup Lento (Startup)
```
Situação: Aplicação Java leva 3 minutos para iniciar
Sem Startup Probe: Liveness mata o container antes de iniciar
Com Startup Probe: Aguarda até 5 minutos (30 * 10s)
Resultado: Aplicação tem tempo suficiente para iniciar
```

### 🔍 Comandos de Debug

```bash
# Ver eventos dos Probes
kubectl describe pod <pod-name>
# Procure por: Liveness probe failed, Readiness probe failed

# Ver logs do container
kubectl logs <pod-name>

# Ver status de readiness
kubectl get pods
# READY 0/1 = Readiness falhou
# READY 1/1 = Readiness OK

# Ver endpoints do Service (Pods prontos)
kubectl get endpoints demo-app

# Forçar falha de Readiness (teste)
kubectl exec <pod-name> -- rm /tmp/healthy
```

### 🎓 Resumo Rápido

| Probe | Quando Usar | Falha → Ação |
|-------|-------------|--------------|
| **Readiness** | Sempre | Remove do Service |
| **Liveness** | Detectar travamentos | Reinicia container |
| **Startup** | Apps com startup lento | Reinicia container |

**Regra de Ouro**: 
- **Readiness** = Controla tráfego (essencial)
- **Liveness** = Detecta problemas graves (opcional)
- **Startup** = Dá tempo para iniciar (raro)

---

## 4. Service

### 🎯 Conceito
O **Service** é uma abstração que expõe um conjunto de Pods como um serviço de rede, fornecendo:
- **IP estável**: Pods têm IPs efêmeros, Services têm IPs fixos
- **Load Balancing**: Distribui tráfego entre Pods
- **Service Discovery**: Nome DNS interno para o serviço

### 🔑 Tipos de Service

#### 4.1 ClusterIP (padrão) - Apenas Interno

**Quando usar**: Comunicação entre serviços DENTRO do cluster

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-api
spec:
  type: ClusterIP          # Padrão, pode omitir
  selector:
    app: backend-api
  ports:
    - port: 80             # Porta do Service
      targetPort: 8080     # Porta do container
```

**Como funciona**:
```
┌─────────────────────────────────────────┐
│           Cluster Kubernetes            │
│                                         │
│  ┌──────────┐      ┌──────────────┐   │
│  │ Pod A    │─────▶│ Service      │   │
│  │ Frontend │      │ ClusterIP    │   │
│  └──────────┘      │ 10.96.0.10   │   │
│                    └──────┬───────┘   │
│                           │            │
│                    ┌──────▼───────┐   │
│                    │ Pod B        │   │
│                    │ Backend      │   │
│                    │ :8080        │   │
│                    └──────────────┘   │
│                                         │
└─────────────────────────────────────────┘
        ❌ Sem acesso externo
```

**Acesso**:
```bash
# Dentro do cluster
curl http://backend-api.default.svc.cluster.local

# DNS curto (mesmo namespace)
curl http://backend-api
```

**Casos de uso**:
- ✅ Banco de dados (PostgreSQL, MySQL)
- ✅ Cache (Redis, Memcached)
- ✅ APIs internas (não expostas publicamente)
- ✅ Message queues (RabbitMQ, Kafka)

---

#### 4.2 NodePort - Acesso via Porta do Node

**Quando usar**: Desenvolvimento local, testes, ambientes sem Load Balancer

```yaml
apiVersion: v1
kind: Service
metadata:
  name: demo-app
spec:
  type: NodePort
  selector:
    app: demo-app
  ports:
    - name: http
      port: 80              # Porta do Service (interna)
      targetPort: 8080      # Porta do container
      nodePort: 30080       # Porta exposta no Node (30000-32767)
```

**Como funciona**:
```
┌─────────────────────────────────────────────────┐
│              Cluster Kubernetes                 │
│                                                 │
│  ┌────────────────────────────────────────┐   │
│  │ Node (localhost)                       │   │
│  │                                        │   │
│  │  Porta 30080 ◄─────────────────┐     │   │
│  │       │                         │     │   │
│  │       ▼                         │     │   │
│  │  ┌─────────────┐                │     │   │
│  │  │ Service     │                │     │   │
│  │  │ NodePort    │                │     │   │
│  │  │ :80         │                │     │   │
│  │  └──────┬──────┘                │     │   │
│  │         │                        │     │   │
│  │    ┌────▼────┐  ┌──────────┐   │     │   │
│  │    │ Pod 1   │  │ Pod 2    │   │     │   │
│  │    │ :8080   │  │ :8080    │   │     │   │
│  │    └─────────┘  └──────────┘   │     │   │
│  └────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
              ▲
              │
    ┌─────────┴─────────┐
    │ Cliente Externo   │
    │ localhost:30080   │
    └───────────────────┘
```

**Acesso**:
```bash
# Docker Desktop (localhost)
curl http://localhost:30080

# Cluster real (IP do Node)
curl http://192.168.1.100:30080

# Dentro do cluster (também funciona)
curl http://demo-app.default.svc.cluster.local
```

**Fluxo de requisição**:
```
Cliente → Node:30080 → Service:80 → Pod:8080
```

**Casos de uso**:
- ✅ Desenvolvimento local (Docker Desktop, Minikube)
- ✅ Testes rápidos
- ✅ Demos e POCs
- ❌ Produção (use LoadBalancer ou Ingress)

**Limitações**:
- Porta fixa (30000-32767)
- Precisa conhecer IP do Node
- Sem balanceamento externo
- Não escalável para produção

---

#### 4.3 LoadBalancer - IP Público (Cloud)

**Quando usar**: Produção em cloud providers (AWS, GCP, Azure)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: public-api
spec:
  type: LoadBalancer
  selector:
    app: public-api
  ports:
    - port: 80
      targetPort: 8080
```

**Como funciona**:
```
┌──────────────────────────────────────────────────────┐
│                  Cloud Provider                      │
│                                                      │
│  ┌────────────────────────────────────────────┐    │
│  │ Load Balancer (AWS ELB / GCP LB)           │    │
│  │ IP Público: 203.0.113.50                   │    │
│  └────────────────┬───────────────────────────┘    │
│                   │                                  │
│  ┌────────────────▼───────────────────────────┐    │
│  │         Cluster Kubernetes                 │    │
│  │                                            │    │
│  │  ┌─────────────┐                          │    │
│  │  │ Service     │                          │    │
│  │  │ LoadBalancer│                          │    │
│  │  └──────┬──────┘                          │    │
│  │         │                                  │    │
│  │    ┌────▼────┐  ┌──────────┐  ┌────────┐│    │
│  │    │ Pod 1   │  │ Pod 2    │  │ Pod 3  ││    │
│  │    │ :8080   │  │ :8080    │  │ :8080  ││    │
│  │    └─────────┘  └──────────┘  └────────┘│    │
│  └────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
                     ▲
                     │
         ┌───────────┴───────────┐
         │ Cliente Internet      │
         │ http://203.0.113.50   │
         └───────────────────────┘
```

**Acesso**:
```bash
# Após criação, obter IP público
kubectl get svc public-api
# NAME        TYPE           CLUSTER-IP     EXTERNAL-IP      PORT(S)
# public-api  LoadBalancer   10.96.0.20     203.0.113.50     80:31234/TCP

# Acessar via IP público
curl http://203.0.113.50
```

**Fluxo de requisição**:
```
Cliente → Load Balancer (IP público) → Service → Pods
```

**Casos de uso**:
- ✅ Produção em AWS, GCP, Azure
- ✅ Aplicações públicas (websites, APIs)
- ✅ Alta disponibilidade
- ✅ Balanceamento automático

**Vantagens**:
- IP público automático
- Balanceamento de carga externo
- Health checks nativos
- Integração com cloud provider

**Custo**:
- 💰 Cobra por Load Balancer (AWS ELB ~$20/mês)
- 💰 Cada Service = 1 Load Balancer
- 💡 Use Ingress para múltiplos serviços (1 Load Balancer)

---

#### 4.4 ExternalName - Alias para Serviço Externo

**Quando usar**: Referenciar serviços FORA do cluster (APIs externas, DBs gerenciados)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-db
spec:
  type: ExternalName
  externalName: mydb.abc123.us-east-1.rds.amazonaws.com
```

**Como funciona**:
```
┌─────────────────────────────────────────────────┐
│           Cluster Kubernetes                    │
│                                                 │
│  ┌──────────┐      ┌──────────────────┐       │
│  │ Pod      │─────▶│ Service          │       │
│  │ App      │      │ ExternalName     │       │
│  └──────────┘      │ external-db      │       │
│                    └──────┬───────────┘       │
│                           │                    │
└───────────────────────────┼────────────────────┘
                            │
                            │ DNS Redirect
                            ▼
              ┌─────────────────────────┐
              │ Serviço Externo         │
              │ AWS RDS / Cloud SQL     │
              │ mydb.abc123.rds.aws.com │
              └─────────────────────────┘
```

**Acesso**:
```bash
# Dentro do cluster
curl http://external-db.default.svc.cluster.local
# Redireciona para: mydb.abc123.us-east-1.rds.amazonaws.com
```

**Casos de uso**:
- ✅ Banco de dados gerenciado (AWS RDS, Cloud SQL)
- ✅ APIs externas (Stripe, SendGrid)
- ✅ Serviços legados fora do cluster
- ✅ Migração gradual para Kubernetes

**Exemplo prático**:
```yaml
# Antes: App conecta direto ao RDS
DATABASE_URL=mydb.abc123.rds.amazonaws.com

# Depois: App usa Service interno
DATABASE_URL=external-db.default.svc.cluster.local
# Kubernetes redireciona para o RDS
```

---

### 🆚 Comparação Detalhada entre Tipos de Service

| Aspecto | ClusterIP | NodePort | LoadBalancer | ExternalName |
|---------|-----------|----------|--------------|--------------|
| **Acesso Externo** | ❌ Não | ✅ Sim (porta Node) | ✅ Sim (IP público) | ➡️ Redirect |
| **Acesso Interno** | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim |
| **IP Público** | ❌ Não | ❌ Não | ✅ Sim | N/A |
| **Porta Fixa** | Não | ✅ 30000-32767 | Não | N/A |
| **Load Balancing** | ✅ Interno | ✅ Interno | ✅ Externo + Interno | ❌ Não |
| **Custo** | Gratuito | Gratuito | 💰 Pago (cloud) | Gratuito |
| **Uso Típico** | APIs internas | Dev/Test | Produção (cloud) | Serviços externos |
| **Produção** | ✅ Sim | ❌ Não | ✅ Sim | ✅ Sim |

### 🎯 Qual Service usar?

```bash
# Cenário 1: Banco de dados interno
✅ ClusterIP
Motivo: Não precisa ser acessado externamente

# Cenário 2: Desenvolvimento local (Docker Desktop)
✅ NodePort
Motivo: Acesso fácil via localhost:30080

# Cenário 3: API pública em produção (AWS/GCP)
✅ LoadBalancer
Motivo: IP público, alta disponibilidade

# Cenário 4: Múltiplos serviços públicos
✅ Ingress (com ClusterIP)
Motivo: 1 Load Balancer para N serviços (economia)

# Cenário 5: Conectar a RDS externo
✅ ExternalName
Motivo: Abstrai URL externa como Service interno
```

### 📦 Exemplo Prático (deste projeto)

```yaml
apiVersion: v1
kind: Service
metadata:
  name: demo-app
spec:
  type: NodePort                # Tipo: NodePort
  selector:
    app: demo-app               # Seleciona Pods com label app=demo-app
  ports:
    - name: http
      port: 80                  # Porta do Service (interna)
      targetPort: 8080          # Porta do container
      nodePort: 30080           # Porta exposta no Node
```

**Funcionamento**:
```
1. Cliente acessa: http://localhost:30080
2. Node redireciona para: Service demo-app:80
3. Service balanceia para: Pods na porta 8080
4. Pod processa e retorna resposta
```

### 🔍 Comandos Úteis

```bash
# Listar services
kubectl get services
kubectl get svc

# Ver detalhes (incluindo IP e Endpoints)
kubectl describe svc demo-app

# Ver Pods associados ao Service
kubectl get endpoints demo-app

# Testar conectividade interna (ClusterIP)
kubectl run test --rm -it --image=busybox -- wget -qO- http://demo-app.default.svc.cluster.local

# Ver IP externo (LoadBalancer)
kubectl get svc demo-app -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Port-forward para teste local
kubectl port-forward svc/demo-app 8080:80
# Acessa: http://localhost:8080
```

### 🎓 Resumo Rápido

| Service | Quando Usar | Acesso |
|---------|-------------|--------|
| **ClusterIP** | Serviços internos | Apenas dentro do cluster |
| **NodePort** | Dev/Test local | `<NodeIP>:<NodePort>` |
| **LoadBalancer** | Produção (cloud) | IP público |
| **ExternalName** | Serviços externos | DNS redirect |

---

## 6. ConfigMap

### 🎯 Conceito
O **ConfigMap** armazena dados de configuração não-sensíveis em pares chave-valor, permitindo:
- **Separação**: Configuração separada do código
- **Reutilização**: Mesmo ConfigMap para múltiplos Pods
- **Atualização**: Alterar config sem rebuild da imagem

### 🔑 Características
- **Não-criptografado**: Dados em texto plano
- **Limite**: 1MB por ConfigMap
- **Tipos de dados**: Strings, arquivos, variáveis de ambiente

### 📦 Exemplo Prático (deste projeto)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: demo-config
data:
  VERSION: "v1"
  MESSAGE: "Hello from ConfigMap"
```

### 🔧 Formas de Consumir ConfigMap

#### 6.1 Como Variáveis de Ambiente (usado neste projeto)
```yaml
spec:
  containers:
    - name: demo-app
      envFrom:
        - configMapRef:
            name: demo-config
      # Resultado: VERSION=v1, MESSAGE=Hello from ConfigMap
```

#### 6.2 Como Variável Individual
```yaml
spec:
  containers:
    - name: demo-app
      env:
        - name: APP_VERSION
          valueFrom:
            configMapKeyRef:
              name: demo-config
              key: VERSION
```

#### 6.3 Como Volume (arquivo)
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config-file
data:
  config.json: |
    {
      "database": "postgres",
      "port": 5432
    }
---
spec:
  containers:
    - name: app
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap:
        name: app-config-file
  # Resultado: arquivo em /etc/config/config.json
```

### 🔍 Comandos Úteis
```bash
# Listar ConfigMaps
kubectl get configmaps
kubectl get cm

# Ver conteúdo
kubectl describe cm demo-config
kubectl get cm demo-config -o yaml

# Criar via comando
kubectl create configmap app-config --from-literal=KEY=value

# Criar de arquivo
kubectl create configmap app-config --from-file=config.json

# Editar
kubectl edit cm demo-config
```

### ⚠️ Quando NÃO usar ConfigMap
- **Dados sensíveis**: Use Secret
- **Dados grandes**: Use Volumes persistentes
- **Dados binários**: Prefira Secrets ou Volumes

---

## 7. Secret

### 🎯 Conceito
O **Secret** armazena dados sensíveis (senhas, tokens, chaves) com:
- **Criptografia**: Dados em base64 (mínimo)
- **Controle de acesso**: RBAC para limitar quem acessa
- **Rotação**: Facilita atualização de credenciais

### 🔑 Tipos de Secret

#### 7.1 Opaque (genérico - usado neste projeto)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: demo-secret
type: Opaque
stringData:              # Texto plano (convertido para base64)
  SECRET_TOKEN: "s3cr3t-token"
```

#### 7.2 docker-registry (credenciais Docker)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: docker-creds
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-encoded-docker-config>
```

#### 7.3 tls (certificados TLS)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: tls-secret
type: kubernetes.io/tls
data:
  tls.crt: <base64-cert>
  tls.key: <base64-key>
```

### 🔧 Formas de Consumir Secret

#### 7.4 Como Variáveis de Ambiente (usado neste projeto)
```yaml
spec:
  containers:
    - name: demo-app
      envFrom:
        - secretRef:
            name: demo-secret
      # Resultado: SECRET_TOKEN=s3cr3t-token
```

#### 7.5 Como Volume (arquivo)
```yaml
spec:
  containers:
    - name: app
      volumeMounts:
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true
  volumes:
    - name: secret-volume
      secret:
        secretName: demo-secret
  # Resultado: arquivo em /etc/secrets/SECRET_TOKEN
```

### 🔍 Comandos Úteis
```bash
# Listar secrets
kubectl get secrets

# Ver detalhes (sem valores)
kubectl describe secret demo-secret

# Ver valores (base64)
kubectl get secret demo-secret -o yaml

# Decodificar valor
kubectl get secret demo-secret -o jsonpath='{.data.SECRET_TOKEN}' | base64 -d

# Criar via comando
kubectl create secret generic db-secret --from-literal=password=mypass

# Criar de arquivo
kubectl create secret generic ssh-key --from-file=~/.ssh/id_rsa
```

### 🆚 ConfigMap vs Secret

| Aspecto | ConfigMap | Secret |
|---------|-----------|--------|
| **Dados** | Não-sensíveis | Sensíveis |
| **Codificação** | Texto plano | Base64 (mínimo) |
| **Criptografia** | ❌ Não | ✅ Opcional (at rest) |
| **Uso** | Configs, flags | Senhas, tokens, chaves |
| **Limite** | 1MB | 1MB |
| **RBAC** | Menos crítico | Crítico |

---

## 8. PersistentVolume (PV) e PersistentVolumeClaim (PVC)

### 🎯 Conceito
**PersistentVolume (PV)** e **PersistentVolumeClaim (PVC)** são componentes para gerenciar **armazenamento persistente** no Kubernetes:

- **PV (PersistentVolume)**: Recurso de armazenamento no cluster (disco físico, NFS, cloud storage)
- **PVC (PersistentVolumeClaim)**: Requisição de armazenamento feita por um Pod

**Analogia**: PV é como um "disco disponível" e PVC é como "pedir um disco com X GB"

### 🔑 Características

#### PersistentVolume (PV)
- **Provisionado pelo admin** ou dinamicamente
- **Independente do Pod**: Sobrevive à exclusão do Pod
- **Tipos**: Local, NFS, AWS EBS, GCP Persistent Disk, Azure Disk, etc.
- **Ciclo de vida**: Independente do Pod

#### PersistentVolumeClaim (PVC)
- **Criado pelo usuário**: Solicita storage com requisitos específicos
- **Bind automático**: Kubernetes encontra PV compatível
- **Usado pelo Pod**: Montado como volume no container

### 📊 Fluxo de Funcionamento

```
1. Admin/StorageClass → Provisiona PV (10Gi) → Estado: Available
2. Usuário → Cria PVC (solicita 5Gi)
3. Kubernetes → Busca PV compatível
4. PVC ↔ PV → Bind (vincula) → Estado: Bound
5. Pod → Monta PVC como volume → Usa storage persistente
6. Pod deletado → PVC e PV PERMANECEM
7. Novo Pod → Monta mesmo PVC → Dados preservados! ✅
```

### 🆚 PV vs PVC vs Volume

| Aspecto | Volume (emptyDir) | PersistentVolume (PV) | PersistentVolumeClaim (PVC) |
|---------|-------------------|----------------------|----------------------------|
| **Persistência** | ❌ Efêmero | ✅ Persistente | ✅ Persistente |
| **Escopo** | Pod | Cluster | Namespace |
| **Sobrevive ao Pod** | ❌ Não | ✅ Sim | ✅ Sim |
| **Quem cria** | Definido no Pod | Admin/StorageClass | Usuário |
| **Uso típico** | Cache temporário | Storage permanente | Solicitar storage |

### 📦 Exemplo 1: PV e PVC Manual

#### 1. Criar PersistentVolume (Admin)

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-local
spec:
  capacity:
    storage: 10Gi
  accessModes:
    - ReadWriteOnce      # RWO: Um Node por vez
  persistentVolumeReclaimPolicy: Retain
  storageClassName: manual
  hostPath:
    path: /mnt/data      # Path no Node (apenas para dev/test)
```

#### 2. Criar PersistentVolumeClaim (Usuário)

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-app
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi       # Solicita 5Gi (PV tem 10Gi)
  storageClassName: manual
```

#### 3. Usar PVC no Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-with-storage
spec:
  containers:
    - name: app
      image: nginx
      volumeMounts:
        - name: storage
          mountPath: /usr/share/nginx/html
  volumes:
    - name: storage
      persistentVolumeClaim:
        claimName: pvc-app    # Referencia o PVC
```

### 🔧 Access Modes (Modos de Acesso)

| Modo | Sigla | Descrição | Uso Típico |
|------|-------|-----------|-----------|
| **ReadWriteOnce** | RWO | Leitura/escrita por **1 Node** | Banco de dados, apps single-instance |
| **ReadOnlyMany** | ROX | Leitura por **múltiplos Nodes** | Assets estáticos, configs compartilhadas |
| **ReadWriteMany** | RWX | Leitura/escrita por **múltiplos Nodes** | Shared storage, NFS, CephFS |

**Importante**: Nem todos os tipos de storage suportam todos os modos!

```bash
# AWS EBS: Apenas RWO
# NFS: RWO, ROX, RWX
# Azure Disk: Apenas RWO
# GCP Persistent Disk: Apenas RWO
```

### 📦 Exemplo 2: Dynamic Provisioning (StorageClass)

#### 1. Criar StorageClass (provisionamento dinâmico)

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: kubernetes.io/aws-ebs    # AWS EBS
parameters:
  type: gp3                            # Tipo de disco
  iops: "3000"
  throughput: "125"
allowVolumeExpansion: true
reclaimPolicy: Delete
```

#### 2. Criar PVC (PV criado automaticamente)

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: pvc-dynamic
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd    # Usa StorageClass
  resources:
    requests:
      storage: 20Gi
```

**Resultado**: Kubernetes cria automaticamente um PV de 20Gi usando AWS EBS!

#### 3. Usar no Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mysql
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
        - name: mysql
          image: mysql:8.0
          env:
            - name: MYSQL_ROOT_PASSWORD
              value: password
          volumeMounts:
            - name: mysql-data
              mountPath: /var/lib/mysql
      volumes:
        - name: mysql-data
          persistentVolumeClaim:
            claimName: pvc-dynamic
```

### 🔄 Reclaim Policy (Política de Recuperação)

Determina o que acontece com o PV quando o PVC é deletado:

| Policy | Comportamento | Uso |
|--------|--------------|-----|
| **Retain** | PV permanece (manual cleanup) | Produção (dados importantes) |
| **Delete** | PV é deletado automaticamente | Dev/Test (storage temporário) |
| **Recycle** | PV é limpo e reutilizado (deprecated) | Não usar |

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-retain
spec:
  capacity:
    storage: 10Gi
  persistentVolumeReclaimPolicy: Retain    # Mantém dados
```

### 📊 Estados do PV e PVC

#### Estados do PV
```bash
Available  # Disponível para bind
Bound      # Vinculado a um PVC
Released   # PVC deletado, mas PV ainda tem dados
Failed     # Erro no provisionamento
```

#### Estados do PVC
```bash
Pending    # Aguardando PV compatível
Bound      # Vinculado a um PV
Lost       # PV foi deletado
```

### 🔍 Comandos Úteis

```bash
# Listar PVs (cluster-wide)
kubectl get pv
# NAME       CAPACITY   ACCESS MODES   RECLAIM POLICY   STATUS
# pv-local   10Gi       RWO            Retain           Bound

# Listar PVCs (namespace)
kubectl get pvc
# NAME       STATUS   VOLUME     CAPACITY   ACCESS MODES
# pvc-app    Bound    pv-local   10Gi       RWO

# Ver detalhes do PV
kubectl describe pv pv-local

# Ver detalhes do PVC
kubectl describe pvc pvc-app

# Ver uso de storage
kubectl get pvc -o custom-columns=NAME:.metadata.name,CAPACITY:.status.capacity.storage,USED:.status.phase

# Deletar PVC (PV pode ser retido ou deletado)
kubectl delete pvc pvc-app

# Listar StorageClasses
kubectl get storageclass
kubectl get sc

# Ver StorageClass padrão
kubectl get sc -o jsonpath='{.items[?(@.metadata.annotations.storageclass\.kubernetes\.io/is-default-class=="true")].metadata.name}'
```

### 🎯 Exemplo 3: StatefulSet com PVC (volumeClaimTemplates)

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:15
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_PASSWORD
              value: password
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:    # Cria PVC automaticamente para cada Pod
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: fast-ssd
        resources:
          requests:
            storage: 50Gi
```

**Resultado**:
```bash
# PVCs criados automaticamente
data-postgres-0   Bound   50Gi
data-postgres-1   Bound   50Gi
data-postgres-2   Bound   50Gi

# Cada Pod tem seu próprio storage persistente!
```

### 💾 Tipos de Storage Backends

#### Local (Dev/Test)
```yaml
hostPath:
  path: /mnt/data
  type: DirectoryOrCreate
```

#### NFS (Shared Storage)
```yaml
nfs:
  server: nfs-server.example.com
  path: /exported/path
```

#### AWS EBS (Cloud)
```yaml
awsElasticBlockStore:
  volumeID: vol-0123456789abcdef
  fsType: ext4
```

#### GCP Persistent Disk
```yaml
gcePersistentDisk:
  pdName: my-disk
  fsType: ext4
```

#### Azure Disk
```yaml
azureDisk:
  diskName: my-disk
  diskURI: /subscriptions/.../disks/my-disk
```

### 🎯 Cenários Práticos

#### Cenário 1: Banco de Dados (MySQL)
```yaml
# PVC para dados do MySQL
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-pvc
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 20Gi
  storageClassName: fast-ssd
```

#### Cenário 2: Uploads de Usuários (Shared Storage)
```yaml
# PVC compartilhado (requer NFS ou similar)
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: uploads-pvc
spec:
  accessModes: [ReadWriteMany]    # Múltiplos Pods
  resources:
    requests:
      storage: 100Gi
  storageClassName: nfs-storage
```

#### Cenário 3: Logs Persistentes
```yaml
# PVC para logs
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: logs-pvc
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 50Gi
```

### 🎓 Resumo Rápido

| Componente | Função | Criado por | Escopo |
|-----------|--------|-----------|--------|
| **PV** | Storage físico | Admin/StorageClass | Cluster |
| **PVC** | Requisição de storage | Usuário | Namespace |
| **StorageClass** | Provisionamento dinâmico | Admin | Cluster |

**Fluxo**: PVC solicita → StorageClass provisiona → PV criado → PVC vincula → Pod usa

**Regra de Ouro**:
- **Stateless apps**: Sem PVC (use emptyDir se necessário)
- **Stateful apps**: Use PVC + StorageClass
- **StatefulSet**: Use volumeClaimTemplates

---

## 9. HorizontalPodAutoscaler (HPA)

### 🎯 Conceito
O **HPA** escala automaticamente o número de Pods baseado em métricas, como:
- **CPU**: Utilização de CPU
- **Memória**: Utilização de memória
- **Custom**: Métricas customizadas (ex: requisições/segundo)

### 🔑 Características
- **Automático**: Escala sem intervenção manual
- **Baseado em métricas**: Requer metrics-server
- **Limites**: Define min/max de réplicas
- **Cooldown**: Evita flapping (escala muito rápida)

### 📦 Exemplo Prático (deste projeto)
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: demo-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: demo-app          # Deployment alvo
  minReplicas: 2            # Mínimo de Pods
  maxReplicas: 5            # Máximo de Pods
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50  # Meta: 50% de CPU
```

### 🔧 Como Funciona

#### Algoritmo de Escala
```
desiredReplicas = ceil[currentReplicas * (currentMetric / targetMetric)]
```

**Exemplo**:
- **Réplicas atuais**: 2
- **CPU atual**: 150% (média entre os Pods)
- **CPU alvo**: 50%
- **Cálculo**: `ceil[2 * (150 / 50)] = ceil[6] = 6`
- **Resultado**: Escala para 5 (limitado por maxReplicas)

#### Ciclo de Escala
```
1. metrics-server coleta métricas
2. HPA calcula média
3. Métrica > Alvo? → Scale Out (+Pods)
4. Métrica < Alvo? → Scale In (-Pods)
5. Métrica = Alvo? → Manter réplicas
6. Aguardar cooldown → Repetir
```

### 📊 Tipos de Métricas

#### 6.1 Resource (CPU/Memória)
```yaml
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
```

#### 6.2 Pods (métricas customizadas por Pod)
```yaml
metrics:
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
```

#### 6.3 Object (métricas de objetos K8s)
```yaml
metrics:
  - type: Object
    object:
      metric:
        name: requests-per-second
      describedObject:
        apiVersion: networking.k8s.io/v1
        kind: Ingress
        name: main-route
      target:
        type: Value
        value: "10k"
```

### 🔍 Comandos Úteis
```bash
# Listar HPAs
kubectl get hpa

# Ver detalhes em tempo real
kubectl get hpa demo-app -w

# Detalhes do HPA
kubectl describe hpa demo-app

# Ver métricas dos Pods
kubectl top pods

# Ver métricas dos Nodes
kubectl top nodes

# Deletar HPA
kubectl delete hpa demo-app
```

### 📈 Demonstração de Escala (deste projeto)

#### Gerar Carga
```bash
# Local (50 concorrentes, 2000 requisições)
seq 2000 | xargs -n1 -P50 -I{} curl -s "http://localhost:30080/cpu?ms=100" >/dev/null

# No cluster (por 60 segundos)
kubectl run load --restart=Never --image=busybox -- \
  /bin/sh -c 'end=$((`date +%s`+60)); while [ `date +%s` -lt $end ]; do wget -q -O- http://demo-app.default.svc.cluster.local/cpu?ms=100 >/dev/null; done'
```

#### Observar Escala
```bash
# Terminal 1: HPA
kubectl get hpa demo-app -w
# NAME       REFERENCE             TARGETS    MINPODS   MAXPODS   REPLICAS
# demo-app   Deployment/demo-app   15%/50%    2         5         2
# demo-app   Deployment/demo-app   180%/50%   2         5         2
# demo-app   Deployment/demo-app   180%/50%   2         5         4
# demo-app   Deployment/demo-app   90%/50%    2         5         5
# demo-app   Deployment/demo-app   45%/50%    2         5         5
# demo-app   Deployment/demo-app   12%/50%    2         5         5
# demo-app   Deployment/demo-app   12%/50%    2         5         2

# Terminal 2: Pods
kubectl get pods -l app=demo-app -w
```

### ⚙️ Pré-requisitos para HPA

#### 1. metrics-server instalado
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Docker Desktop: patch para TLS inseguro
kubectl -n kube-system patch deployment metrics-server --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# Verificar
kubectl top pods
```

#### 2. Resources definidos no Deployment
```yaml
resources:
  requests:
    cpu: "50m"      # OBRIGATÓRIO para HPA baseado em CPU
    memory: "64Mi"
  limits:
    cpu: "250m"
    memory: "128Mi"
```

### 🆚 HPA vs Escala Manual

| Aspecto | Escala Manual | HPA |
|---------|--------------|-----|
| **Automação** | ❌ Manual | ✅ Automático |
| **Reação** | Lenta | Rápida |
| **Métricas** | Não usa | Baseado em métricas |
| **Custo** | Fixo | Otimizado |
| **Complexidade** | Simples | Requer setup |
| **Uso** | Dev/Test | Produção |

---

## 10. Comparação entre Componentes

### 📊 Tabela Resumida

| Componente | Função | Escopo | Gerencia |
|-----------|--------|--------|----------|
| **Pod** | Unidade de execução | Containers | N/A |
| **Deployment** | Gerencia Pods stateless | ReplicaSets/Pods | Pods |
| **StatefulSet** | Gerencia Pods stateful | Pods com identidade | Pods + PVCs |
| **Service** | Expõe Pods | Rede | Endpoints |
| **ConfigMap** | Configuração | Dados não-sensíveis | N/A |
| **Secret** | Credenciais | Dados sensíveis | N/A |
| **PV** | Storage físico | Cluster | Armazenamento |
| **PVC** | Requisição de storage | Namespace | Bind com PV |
| **HPA** | Autoscaling | Réplicas | Deployment/StatefulSet |

### 🔗 Relações entre Componentes

**Workload Stateless**:
```
HPA → escala → Deployment → cria → ReplicaSet → gerencia → Pods
Pods → consomem → ConfigMap + Secret
Service → seleciona → Pods (via labels)
metrics-server → coleta métricas → Pods → fornece para → HPA
```

**Workload Stateful**:
```
StatefulSet → cria → Pods (mysql-0, mysql-1, mysql-2)
Pods → usam → PVCs (PVC-0, PVC-1, PVC-2)
PVCs → bind → PVs (storage persistente)
Pods → consomem → ConfigMap + Secret
Headless Service → DNS estável por Pod
```

### 🎯 Fluxo de Requisição

```
1. Cliente → HTTP Request → Service
2. Service → Load Balance → Seleciona Pod
3. Pod → Lê ConfigMap (VERSION)
4. Pod → Lê Secret (SECRET_TOKEN)
5. Pod → Processa requisição
6. Pod → HTTP Response → Service → Cliente
```

---

## 🎓 Resumo Executivo

### Quando usar cada componente?

| Componente | Use quando... |
|-----------|--------------|
| **Pod** | Nunca diretamente em produção (use Deployment/StatefulSet) |
| **Deployment** | Aplicações stateless (APIs, web apps, workers) |
| **StatefulSet** | Aplicações stateful (bancos de dados, Kafka, Redis) |
| **Service** | Sempre que precisar expor Pods (interno ou externo) |
| **ConfigMap** | Configurações não-sensíveis (flags, URLs, configs) |
| **Secret** | Dados sensíveis (senhas, tokens, chaves, certificados) |
| **PV/PVC** | Storage persistente (bancos, uploads, logs) |
| **HPA** | Carga variável e necessidade de otimização de recursos |

### Decisão: Deployment vs StatefulSet?

```bash
# Use Deployment se:
✅ Aplicação stateless (não mantém estado local)
✅ Pods são intercambiáveis (qualquer Pod pode processar qualquer requisição)
✅ Não precisa de storage persistente por Pod
✅ Ordem de criação/exclusão não importa
Exemplos: APIs REST, Web servers, Workers

# Use StatefulSet se:
✅ Aplicação stateful (mantém estado local)
✅ Cada Pod tem identidade única
✅ Precisa de storage persistente por Pod
✅ Ordem de criação/exclusão importa
✅ Precisa de DNS estável por Pod
Exemplos: MySQL, PostgreSQL, MongoDB, Kafka, Redis, ZooKeeper
```

### Decisão: Qual tipo de Service?

```bash
# ClusterIP (padrão)
✅ Comunicação interna no cluster
Exemplo: Backend API, Banco de dados

# NodePort
✅ Desenvolvimento local (Docker Desktop, Minikube)
Exemplo: Testar app localmente

# LoadBalancer
✅ Produção em cloud (AWS, GCP, Azure)
Exemplo: API pública, Website

# ExternalName
✅ Referenciar serviços externos
Exemplo: AWS RDS, APIs externas
```

### Ordem de criação recomendada

#### Para aplicações stateless (Deployment):
```
1. ConfigMap/Secret (configuração)
2. Deployment (workload)
3. Service (rede)
4. HPA (autoscaling - opcional)
```

#### Para aplicações stateful (StatefulSet):
```
1. ConfigMap/Secret (configuração)
2. StorageClass (se não existir)
3. Headless Service (clusterIP: None)
4. StatefulSet (com volumeClaimTemplates)
5. Service (para acesso externo - opcional)
```

### Comandos essenciais

```bash
# Ver tudo
kubectl get all

# Ver com labels
kubectl get all -l app=demo-app

# Logs
kubectl logs -f deployment/demo-app

# Escala
kubectl scale deployment demo-app --replicas=3

# Port-forward (debug)
kubectl port-forward deployment/demo-app 8080:8080

# Executar comando
kubectl exec -it deployment/demo-app -- /bin/sh

# Deletar tudo
kubectl delete all -l app=demo-app
```

---

## 📚 Referências

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Pod Lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)
- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)

---

**Projeto**: demo-kubernetes-local  
**Versão**: 1.0  
**Última atualização**: 2024
