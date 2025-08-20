# Demo completa: Docker Desktop + Kubernetes (Node.js)

Aplicação Node.js (Express) com endpoints `/`, `/health` e `/cpu?ms=100`.
Fluxo: build Docker → deploy no Kubernetes do Docker Desktop → HPA com teste de carga.

## Documentação complementar
- Arquitetura: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Fluxo end-to-end: [FLOW.md](./FLOW.md)

## 1) Pré-requisitos
- Docker Desktop (Kubernetes habilitado)
- kubectl (vem com Docker Desktop)

Verifique/defina o contexto:
```bash
kubectl config get-contexts
kubectl config use-context docker-desktop
```

## 2) Build e teste local (Docker)
```bash
docker build -t demo-app:local .
docker run --rm -p 8080:8080 demo-app:local
# novo terminal
curl http://localhost:8080/health
curl http://localhost:8080/
# CTRL+C para parar o container
```

## 3) Deploy no Kubernetes (NodePort)
Service já configurado como NodePort 30080 (`k8s/service.yaml`).
```bash
# build da imagem (compartilhada com o cluster docker-desktop)
docker build -t demo-app:local .

# aplicar manifests (Deployment/Service/ConfigMap/Secret)
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# verificar
kubectl get pods -l app=demo-app -w
kubectl get svc demo-app -o wide
curl http://localhost:30080/health
```

## 4) Probes e Resources
- `readinessProbe` e `livenessProbe` em `/health`.
- `resources` (requests/limits) para CPU/memória.

## 5) Instalar métricas (metrics-server)
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl -n kube-system patch deployment metrics-server --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'

# verifique
kubectl -n kube-system rollout status deploy/metrics-server
kubectl top pods || echo "Sem metrics-server?"
```

## 6) HPA (autoscaling)
```bash
kubectl apply -f k8s/hpa.yaml
kubectl get hpa demo-app -w
```

## 7) Gerar carga
- Local (50 concorrentes, 2000 req):
```bash
seq 2000 | xargs -n1 -P50 -I{} curl -s "http://localhost:30080/cpu?ms=100" >/dev/null
```
- No cluster (por 60s):
```bash
kubectl run load --restart=Never --image=busybox -- \
  /bin/sh -c 'end=$((`date +%s`+60)); while [ `date +%s` -lt $end ]; do wget -q -O- http://demo-app.default.svc.cluster.local/cpu?ms=100 >/dev/null; done'
```

Observe o HPA/pods:
```bash
kubectl get hpa demo-app -w
kubectl get pods -l app=demo-app -w
```

## 8) Rollout e escala manual (opcional)
```bash
kubectl set env deploy/demo-app VERSION=v2
kubectl rollout status deploy/demo-app
kubectl scale deploy demo-app --replicas=2
```

## 9) Cleanup (limpar cluster e imagem local)
```bash
kubectl delete -f k8s/hpa.yaml --ignore-not-found
kubectl delete -f k8s/ --ignore-not-found
kubectl delete -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml --ignore-not-found
docker image rm -f demo-app:local || true
```
