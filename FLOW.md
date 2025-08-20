# Fluxo End-to-End da Demo

Este documento descreve o passo a passo operacional para construir, implantar e demonstrar o autoscaling da aplicação.

## Visão Geral do Fluxo
1. Build da imagem Docker da aplicação Node.js.
2. Teste local do container (porta 8080).
3. Deploy no Kubernetes (Docker Desktop): Deployment, Service (NodePort), ConfigMap, Secret.
4. Instalação do metrics-server para habilitar métricas.
5. Aplicação do HPA (CPU-based, 2–5 réplicas, alvo 50%).
6. Geração de carga no endpoint `/cpu` para elevar o uso de CPU.
7. Observação do scale-out/scale-in pelo HPA.
8. Limpeza (cleanup) do ambiente.

## Passos Detalhados

### 1) Build Docker
```bash
docker build -t demo-app:local .
```

### 2) Teste local
```bash
docker run --rm -p 8080:8080 demo-app:local
# novo terminal
curl http://localhost:8080/health
curl http://localhost:8080/
# CTRL+C para encerrar
```

### 3) Deploy no Kubernetes (Docker Desktop)
Certifique-se de usar o contexto `docker-desktop`.
```bash
kubectl config use-context docker-desktop
```
Aplique os manifests essenciais:
```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```
Valide:
```bash
kubectl get pods -l app=demo-app -w
kubectl get svc demo-app -o wide
curl http://localhost:30080/health
```

### 4) Instalar métricas (metrics-server)
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl -n kube-system patch deployment metrics-server --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

kubectl -n kube-system rollout status deploy/metrics-server
kubectl top pods || echo "Sem metrics-server?"
```

### 5) Aplicar HPA
```bash
kubectl apply -f k8s/hpa.yaml
kubectl get hpa demo-app -w
```

### 6) Gerar carga (CPU)
Opção local (50 concorrentes, 2000 req):
```bash
seq 2000 | xargs -n1 -P50 -I{} curl -s "http://localhost:30080/cpu?ms=100" >/dev/null
```
Opção no cluster (por 60s):
```bash
kubectl run load --restart=Never --image=busybox -- \
  /bin/sh -c 'end=$((`date +%s`+60)); while [ `date +%s` -lt $end ]; do wget -q -O- http://demo-app.default.svc.cluster.local/cpu?ms=100 >/dev/null; done'
```

### 7) Observar o autoscaling
```bash
kubectl get hpa demo-app -w
kubectl get pods -l app=demo-app -w
kubectl top pods
```
A tendência esperada é aumento das réplicas até o limite do HPA quando a utilização de CPU ultrapassa a meta, e redução gradual quando a carga cessa.

### 8) Rollout e escala manual (opcional)
```bash
kubectl set env deploy/demo-app VERSION=v2
kubectl rollout status deploy/demo-app
kubectl scale deploy demo-app --replicas=2
```

### 9) Cleanup
```bash
kubectl delete -f k8s/hpa.yaml --ignore-not-found
kubectl delete -f k8s/ --ignore-not-found
kubectl delete -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml --ignore-not-found
docker image rm -f demo-app:local || true
```

## Critérios de Sucesso
- `kubectl top` retorna métricas de pods.
- `kubectl get hpa` mostra TARGETS variando e REPLICAS escalando (ex.: `cpu: 300%/50% -> 5 réplicas`).
- Serviço acessível em `http://localhost:30080`.
