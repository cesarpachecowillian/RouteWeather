# RouteWeather

Aplicação que recebe **origem**, **destino** e **horário** (de partida ou de chegada) e produz um relatório completo da viagem com:

- Várias rotas alternativas, descritas pelas vias principais (ex.: "Via BR-101")
- **Distância e duração** de cada alternativa
- **Previsão do tempo hora-a-hora** em pontos amostrados ao longo do trajeto, no horário em que o usuário estará passando por cada ponto
- **Alertas** automáticos para chuva, neve, neblina, tempestade, vento forte, calor/frio extremo e chuva congelante
- **Mapa interativo** com a rota traçada nas ruas reais, marcadores coloridos por severidade, hover com previsão do ponto, alternância entre visão de rua e satélite
- **Histórico** local de buscas (localStorage), modos de viagem (carro, moto, ônibus, bicicleta, a pé), cancelamento de cálculo em andamento

## Stack

- **Backend** — Spring Boot 3 + Java 21 + Maven (porta **8081**)
- **Frontend** — React 18 + Vite + TypeScript + Tailwind + Leaflet (porta **3001**)
- **Containerização** — Docker Compose com Dockerfiles multi-stage para imagens enxutas

## Estrutura do repositório

```
RouteWeather/
├── backend/                Spring Boot
├── frontend/               React + Vite (servido por nginx em produção)
├── docker-compose.yml
├── .env.example            modelo das variáveis (copie para .env)
├── LICENSE                 MIT
└── README.md               este arquivo
```

## APIs externas e por que cada uma é chamada

A aplicação combina **APIs do Google** (pagas, com camada gratuita generosa) com **serviços públicos baseados em OpenStreetMap** como fallback resiliente. Sempre que possível há uma camada de queda para que falhas pontuais não derrubem a feature.

| Quem | Para que serve | Quando | Chave necessária |
|---|---|---|---|
| **Google Routes API** | Cálculo da rota: polyline detalhada, distância, duração, descrição do trajeto ("BR-381"), alternativas, suporte a Carro / Moto / Ônibus / Bicicleta / A pé | Sempre, em todo `POST /api/trip` | ✓ (Routes API) |
| **Google Geocoding API** | Reverse geocoding (lat/lng → "Joinville, SC") em cada waypoint para mostrar a cidade no card e nos alertas | Após calcular cada rota | ✓ (Geocoding API) — *opcional, cai para Photon se não habilitada* |
| **Google Places API (New)** | Autocomplete dos campos de origem e destino, com sugestões idiomáticas em pt-BR ("Curitiba, PR" em vez de "Curitiba, Paraná, Região Sul, Brasil") | Enquanto o usuário digita | ✓ (Places API New) — *opcional, cai para Nominatim se não habilitada* |
| **Open-Meteo** | Previsão horária do tempo (temperatura, precipitação, vento, umidade, código WMO da condição) — chamada em **batch** com todas as coordenadas de uma rota em uma única requisição | Após calcular cada rota | ✗ (gratuita, sem chave) |
| **OpenStreetMap (Nominatim)** | (a) fallback do autocomplete; (b) **forward geocoding** de origem/destino quando o Google Routes devolve resposta vazia para pares de endereços muito distantes — nesse caso o backend converte os endereços em lat/lng e refaz a chamada de rota | Sob demanda, como fallback | ✗ |
| **Photon (Komoot)** | Fallback do reverse geocoding quando a Geocoding API não está habilitada ou falha | Sob demanda, como fallback | ✗ |
| **Tiles OSM** | Tiles do mapa no modo "Mapa" (visual padrão do OpenStreetMap) | No mapa interativo | ✗ |
| **ESRI World Imagery** | Tiles de satélite no modo "Satélite" do toggle do mapa | Quando o usuário ativa | ✗ |

> A mesma chave do Google é compartilhada por padrão para **Routes**, **Geocoding** e **Places (New)**. Você só precisa habilitar cada API no projeto da console e adicionar à lista de **Restrições de API** da chave.

### Por que Open-Meteo e não outra API de clima?

- **Gratuita e sem chave**, com cobertura global
- Aceita **lote de coordenadas** numa única chamada (`latitude=lat1,lat2,...&longitude=lng1,lng2,...`), o que é perfeito para a varredura de waypoints — uma rota inteira fica em uma só requisição
- Códigos WMO padronizados, fáceis de mapear para ícones e categorias de alerta

### Por que três geocodificadores diferentes?

Resiliência. Cada um tem suas limitações:

- **Google Geocoding** é o melhor para nomes de cidades e abreviações de estado, mas requer ativação extra.
- **Photon** é gratuito e parallelizável, mas a instância pública às vezes fica lenta ou inacessível e nem sempre identifica a cidade em pontos rurais (códigos OSM diferentes).
- **Nominatim** é gratuito e cobre tudo que está no OSM, mas a instância pública limita a 1 requisição/segundo via Varnish; em uso intenso o IP é bloqueado por horas.

A camada de cache em memória (~5 km de granularidade) reduz drasticamente a quantidade de chamadas reais.

## Pré-requisitos

- **Docker** e **Docker Compose** (Docker Desktop no Windows/macOS, `docker.io` no Linux)
- Uma **chave da API do Google Cloud** com pelo menos **Routes API** habilitada

Para o modo de desenvolvimento **sem** Docker (opcional), são necessários também:

- **JDK 21** e **Maven 3.9+** para o backend
- **Node.js 20+** para o frontend

### Configurando o Google Cloud (obrigatório)

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie ou selecione um projeto.
2. Em **APIs e Serviços → Biblioteca**, habilite:
   - **Routes API** (obrigatório)
   - **Geocoding API** (opcional — habilita os nomes de cidade nos cards)
   - **Places API (New)** (opcional — habilita o autocomplete de endereços do Google)
3. Em **APIs e Serviços → Credenciais**, crie uma chave de API.
4. Clique na chave e em **Restrições de API** selecione "Restringir chave" e marque as APIs habilitadas acima — **inclua todas que você ativou**, senão a chave será rejeitada para cada API que não estiver na lista. Salve.
5. (Recomendado) Em **Restrições de aplicativo**, restrinja por endereço IP do servidor que vai consumir.

> A propagação das alterações na chave leva até alguns minutos.

## Configuração

Clone o repositório:

```bash
git clone https://github.com/cesarpachecowillian/RouteWeather.git
cd RouteWeather
```

Copie o arquivo de exemplo e preencha sua chave:

```bash
cp .env.example .env
```

Edite `.env`:

```dotenv
# Obrigatório
GOOGLE_ROUTES_API_KEY=<sua-chave-aqui>

# URL que o frontend usará para falar com o backend (build-time do Vite)
VITE_API_BASE_URL=http://localhost:8081

# Origens permitidas no CORS do backend (separadas por vírgula)
CORS_ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000

# Opcionais — se você quiser usar uma chave diferente para Geocoding/Places
# (caso contrário, GOOGLE_ROUTES_API_KEY é reutilizada para todas)
# GOOGLE_GEOCODING_API_KEY=
# GOOGLE_PLACES_API_KEY=
```

`.env` está no `.gitignore`. Nunca commite.

## Executando

```bash
docker compose up --build           # build + sobe os 2 containers
docker compose up --build -d        # em background
docker compose logs -f backend      # acompanhar logs do backend
docker compose down                 # parar tudo
```

Endereços:

- Frontend: <http://localhost:3001>
- Backend: <http://localhost:8081>
- Swagger UI (documentação interativa): <http://localhost:8081/swagger-ui.html>

### Reconstruindo apenas um serviço

```bash
docker compose up --build -d backend
docker compose up --build -d frontend
```

> A URL do backend para o frontend (`VITE_API_BASE_URL`) é congelada **no momento do build** da imagem do frontend (build-arg do Vite). Se você mudar essa URL, é necessário reconstruir o serviço `frontend`.

## Desenvolvimento sem Docker

### Backend

```bash
cd backend
GOOGLE_ROUTES_API_KEY=... mvn spring-boot:run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Endpoint principal: `POST /api/trip`

### Request

Exatamente um entre `departureTime` ou `arrivalTime` deve ser informado. `travelMode` aceita: `DRIVE`, `TWO_WHEELER`, `TRANSIT`, `BICYCLE`, `WALK` (default: `DRIVE`).

```json
{
  "origin": "Curitiba, PR",
  "destination": "Florianópolis, SC",
  "departureTime": "2026-05-03T08:00:00",
  "travelMode": "DRIVE"
}
```

Modo "chegar às" (o backend calcula o horário de partida):

```json
{
  "origin": "Curitiba, PR",
  "destination": "Florianópolis, SC",
  "arrivalTime": "2026-05-03T18:00:00",
  "travelMode": "DRIVE"
}
```

### Response

`200 OK` com uma **lista de alternativas**. A primeira é a recomendada pelo Google.

```json
[
  {
    "origin": "Curitiba, PR",
    "destination": "Florianópolis, SC",
    "description": "BR-101",
    "encodedPolyline": "blaqClqulHt@...",
    "totalDistanceKm": 306.5,
    "totalDurationMinutes": 218,
    "departureTime": "2026-05-03T08:00:00",
    "arrivalTime": "2026-05-03T11:38:00",
    "waypoints": [
      {
        "lat": -25.4269,
        "lng": -49.2652,
        "estimatedArrival": "2026-05-03T08:00:00",
        "distanceFromStartKm": 0.0,
        "cityName": "Curitiba, PR",
        "weather": {
          "conditionCode": 3,
          "conditionLabel": "Parcialmente nublado",
          "temperatureCelsius": 18.5,
          "precipitationMm": 0.0,
          "windSpeedKmh": 12.0,
          "humidity": 78,
          "icon": "cloudy"
        }
      }
    ],
    "alerts": [
      {
        "type": "RAIN",
        "waypointIndex": 4,
        "message": "km 90–150 · Joinville, SC → Itajaí, SC · 09h45–10h35"
      }
    ]
  }
]
```

#### Tipos de alerta

| `type` | Critério |
|---|---|
| `RAIN` | Códigos WMO 61–65, 80–82 (chuva e pancadas de chuva) |
| `SNOW` | Códigos 71–75, 77, 85, 86 (neve, grãos de neve, pancadas de neve) |
| `FREEZING_PRECIP` | Códigos 56, 57, 66, 67 (garoa congelante e chuva congelante) |
| `STORM` | Códigos 95, 96, 99 (tempestade) |
| `FOG` | Códigos 45, 48 (neblina) |
| `WIND` | Vento > 60 km/h |
| `HEAT` | Temperatura ≥ 38 °C |
| `COLD` | Temperatura ≤ 2 °C |

Alertas de chuva/neve/congelante agrupam waypoints consecutivos em uma única mensagem com a faixa de km, cidades e horários. Os demais sinalizam o primeiro waypoint que cruza o limite.

### Códigos de erro

- **400 Bad Request** — validação falhou: faltam ambos os horários, horário no passado, mais de 14 dias à frente, ou (em modo `arrivalTime`) o horário implicaria saída no passado para todas as alternativas
- **502 Bad Gateway** — falha na Google Routes API (chave inválida, rota não encontrada, etc.)
- **500 Internal Server Error** — outros erros não tratados

Corpo do erro:

```json
{ "error": "Horário de chegada precisa ser no futuro" }
```

## Endpoint auxiliar: `GET /api/places/autocomplete?q=...`

Sugestões de endereço para o autocomplete da UI. Tenta o **Google Places API (New)** primeiro; se a API não estiver habilitada/autorizada, cai para o Nominatim. Resposta:

```json
[
  { "displayName": "Curitiba, PR",     "lat": "",          "lng": "" },
  { "displayName": "Curitibanos, SC",  "lat": "",          "lng": "" }
]
```

> `lat`/`lng` ficam vazios quando a sugestão veio do Google Places (que não retorna coordenadas no autocomplete) e populados quando vem do Nominatim.

## Comportamentos e detalhes importantes

- **Amostragem dos waypoints**: derivada do tempo da viagem. Em viagens curtas há um piso de pontos (default 8) e em viagens longas o intervalo é aproximadamente `target-interval-hours × velocidade média` (default 1.25 h). Sem teto superior em viagens longas: uma viagem de 22 h gera ~18 pontos. Configurável em `backend/src/main/resources/application.yml`.
- **Resiliência da Routes API**: para pares de endereços muito distantes (ex: SP → Salvador), a Google Routes às vezes devolve uma resposta vazia. O backend faz três tentativas: (1) endereços com alternativas e tráfego, (2) endereços simples, (3) geocoda origem e destino via Nominatim e retenta com lat/lng. Sem o passo (3), trajetos transcontinentais falham.
- **Concorrência**: as alternativas são processadas em paralelo (virtual threads do Java 21). As chamadas externas têm semáforos para evitar 429s do Open-Meteo.
- **Cache**: o reverse geocoding tem cache em memória com chave de ~5 km — alternativas que cruzam a mesma região reaproveitam.
- **Cancelamento**: o cliente pode abortar uma requisição em andamento; o frontend restaura a rota anterior ao cancelar.
- **Histórico**: as últimas 12 buscas ficam no `localStorage` do navegador (chave `rw:history:v1`), com dedupe por `origem|destino|modo`. Apenas o cliente conhece — sem persistência no backend.

## Documentação adicional

- Swagger UI em `/swagger-ui.html` quando o backend está rodando — contrato completo dos endpoints, gerado a partir do código.

## Licença

[MIT](./LICENSE).
