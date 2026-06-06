# ClimaLogix ClimateShield Recommended Workflow

This diagram upgrades the product from a module dashboard into an SME operating system:

- Commerce handles orders, products, customers, and batch registration.
- Product Trust verifies whether a batch is safe and credible.
- Climate Supply Chain checks whether the batch can survive the delivery route and time window.
- AI Decision Layer recommends the next operational action.
- AI CostShield makes sure AI usage stays within budget and proves ROI.
- Authentication and access control protect each workflow by role: SME owner, buyer, warehouse, delivery partner, and admin.
- Business Intelligence turns successful decisions into ESG, savings, and growth metrics.

```mermaid
flowchart TB
  subgraph auth[Authentication + Access Control Layer]
    login[Login / Signup]
    roles[Role-Based Access Control<br/>SME Owner, Buyer, Warehouse, Delivery, Admin]
    session[Secure Session / JWT]
    permissions[Permissions + Audit Logs]
  end

  subgraph users[Users + External Actors]
    owner[SME Owner]
    buyer[Buyer / Customer]
    warehouse[Warehouse / Industry]
    delivery[Delivery Partner<br/>Pathao / Uber / Local Rider]
  end

  subgraph commerce[Commerce Layer]
    marketplace[Marketplace]
    order[Order + Destination]
    registry[Batch Registry]
  end

  subgraph trust[Product Trust Layer]
    iot[IoT / QA Readings<br/>pH, EC, temp, fermentation days]
    verify[Product Verification]
    trustScore[Trust Score]
  end

  subgraph climate[Climate Supply Chain Layer]
    weather[Weather Signals]
    micro[Microclimate Intelligence]
    routeRisk[Route + Zone Risk]
    dvs[Delivery Viability Score]
  end

  subgraph decision[AI Decision Layer]
    assistant[AI Assistant / Copilot]
    ai[AI Decision Engine]
    cost[AI CostShield<br/>budget, tokens, ROI]
  end

  subgraph execution[Execution Layer]
    recommendation[Dispatch Recommendation<br/>accept, delay, reroute, change packaging, reject]
    confirm[SME / Warehouse Confirmation]
    dispatch[Climate-Safe Dispatch]
    receipt[Customer Receipt Confirmation]
  end

  subgraph intelligence[Business Intelligence Layer]
    impact[Impact Dashboard]
    esg[ESG Report]
    roi[AI ROI + Spoilage Prevented]
  end

  subgraph platform[Platform Infrastructure]
    api[Express API on Render]
    db[(Supabase PostgreSQL + pgvector)]
    edge[Supabase Edge Functions]
    llm[Groq / LLM Provider]
    weatherApi[Weather APIs]
  end

  buyer --> login
  owner --> login
  warehouse --> login
  delivery --> login
  login --> roles
  roles --> session
  session --> permissions

  permissions --> api
  api --> marketplace
  api --> registry
  api --> verify
  api --> confirm
  api --> receipt
  api --> db
  api --> edge
  ai --> llm
  weather --> weatherApi

  marketplace --> order
  order --> registry

  registry --> iot
  iot --> verify
  verify --> trustScore

  order --> weather
  weather --> micro
  micro --> routeRisk
  routeRisk --> dvs

  trustScore --> ai
  dvs --> ai
  order --> ai
  assistant <--> ai
  cost <--> ai

  ai --> recommendation
  recommendation --> confirm
  confirm --> warehouse
  warehouse --> dispatch
  dispatch --> delivery
  delivery --> receipt
  receipt --> buyer

  receipt --> impact
  trustScore --> impact
  dvs --> impact
  cost --> roi
  impact --> esg
  impact --> roi
```

## Pitch Version

ClimaLogix ClimateShield connects authenticated commerce, product trust, weather intelligence, and climate-safe logistics into one SME operating layer. Every order is checked against user permissions, batch quality, and route climate risk before dispatch. The AI Decision Engine recommends whether to accept, delay, reroute, improve packaging, or reject a delivery. AI CostShield keeps the SME protected from uncontrolled token spending by linking every AI call to business ROI.
