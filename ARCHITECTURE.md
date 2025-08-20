# Arquitetura da Demo (Docker Desktop + Kubernetes)

Esta documentação descreve os componentes, responsabilidades e relações do projeto localizado em `demo-docker-kubernetes/`.

## Componentes

- Aplicação (`src/index.js`)
  - Node.js + Express.
  - Endpoints:
    - `GET /` → JSON com `message` (de `ConfigMap`), `version` e `timestamp`.
    - `GET /health` → 200 OK (probes de liveness/readiness usam este endpoint).
    - `GET /cpu?ms=100` → consome CPU por N ms (busy-wait) para demonstrar HPA baseado em CPU.

- Container (Docker)
  - `Dockerfile`: base `node:20-alpine`, copia app e instala deps, expõe `8080`, `npm start`.
  - `.dockerignore`: evita enviar arquivos desnecessários ao build.

- Kubernetes (`k8s/`)
  - `deployment.yaml`
    - `Deployment` com rótulo `app=demo-app`.
    - 2 réplicas por padrão.
    - `envFrom` de `ConfigMap` e `Secret`.
    - `readinessProbe`/`livenessProbe` em `/health`.
    - `resources` (requests/limits) para CPU e memória (necessários para HPA baseado em CPU funcionar corretamente).
  - `service.yaml`
    - `Service` tipo `NodePort` fixo em `30080` → acesso via `http://localhost:30080` no Docker Desktop.
  - `configmap.yaml`
    - `ConfigMap` com `VERSION` e `MESSAGE` consumidos pela aplicação.
  - `secret.yaml`
    - `Secret` (Opaque) com `SECRET_TOKEN` (exemplo de variável sensível).
  - `hpa.yaml`
    - `HorizontalPodAutoscaler` (v2) mirando `Deployment/demo-app`.
    - Meta: 50% de uso de CPU (utilization), min=2, max=5 réplicas.

- Métricas do cluster
  - `metrics-server` instalado via manifesto oficial.
  - Patch `--kubelet-insecure-tls` pode ser necessário em ambientes locais (Docker Desktop) para coleta de métricas.

## Diagrama Lógico (alto nível)

```
[Cliente] --> NodePort 30080 --> [Service demo-app] --> [Pods (Deployment demo-app)]
                                                \---> Probes (/health)

[Pods] <--envFrom-- [ConfigMap: demo-config]
[Pods] <--envFrom-- [Secret: demo-secret]

[HPA] <--- métricas CPU --- [metrics-server] <--- kubelets
```

## Decisões de Design

- Node.js + Express pela simplicidade e familiaridade.
- `Service` como `NodePort` para acesso direto em `localhost` sem ingress.
- `readinessProbe` e `livenessProbe` em `/health` para demonstrar práticas de produção.
- `resources` configurados para habilitar HPA por CPU.
- `ConfigMap`/`Secret` para separar configuração e segredos do contêiner.
- Endpoint `/cpu` para gerar carga de CPU sem ferramentas externas.

## Considerações de Segurança

- Segredos via `Secret` Kubernetes (não expostos na resposta HTTP).
- TLS do kubelet está inseguro apenas para o `metrics-server` em ambiente local; evitar em produção.
- Sem RBAC customizado e sem NetworkPolicy (podem ser adicionados para ambientes mais restritos).

## Observabilidade e Saúde

- Probes permitem que o Kubernetes identifique pods prontos e saudáveis.
- `metrics-server` viabiliza `kubectl top` e HPA baseado em CPU.

## Escalabilidade

- HPA escala réplicas do `Deployment` conforme a pressão de CPU.
- `minReplicas` e `maxReplicas` definem limites do autoscaling.

## Limitações Conhecidas

- Acesso externo via `NodePort` (sem Ingress/LoadBalancer) — suficiente para demo local.
- Sem CI/CD; build e deploy feitos manualmente via comandos.
- O `/cpu` usa busy-wait; não reflete workloads reais, mas é ideal para demonstrar HPA.
