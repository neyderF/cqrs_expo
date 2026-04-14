# Modelo de Lectura

## Propósito
El modelo de lectura concentra las estructuras optimizadas para consulta del portal web, soporte operativo y herramientas de BI. Estas tablas no son la fuente de verdad del dominio. Su función es responder rápido y de forma clara preguntas del negocio a partir de eventos ya procesados por las proyecciones.

## Principios del modelo de lectura
- Está orientado a consulta, no a decisiones de negocio.
- Puede repetir o desnormalizar datos para simplificar lecturas.
- Se actualiza a partir de eventos del dominio como `BagCreated`, `InvoiceConsumed` y `ConsumptionReversed`.
- Puede existir consistencia eventual respecto al Event Store.

## 1. client_balance_view
Sirve para responder preguntas como: cuánto saldo total tiene un cliente, cuántas bolsas activas posee y cuál es la siguiente bolsa que vencerá.

| Campo | Tipo | Descripción |
|---|---|---|
| `client_id` | `UUID` | Identificador del cliente. Clave primaria. |
| `total_available_balance` | `INTEGER` | Total de facturas disponibles en todas las bolsas activas del cliente. |
| `active_bags` | `INTEGER` | Número de bolsas activas del cliente. |
| `next_expiring_bag_id` | `UUID` | Identificador de la siguiente bolsa próxima a vencer. |
| `next_expiration_date` | `DATE` | Fecha de vencimiento de la próxima bolsa. |
| `updated_at` | `TIMESTAMPTZ` | Fecha y hora de la última actualización de la fila. |

### SQL sugerido
```sql
CREATE TABLE client_balance_view (
  client_id UUID PRIMARY KEY,
  total_available_balance INTEGER NOT NULL DEFAULT 0,
  active_bags INTEGER NOT NULL DEFAULT 0,
  next_expiring_bag_id UUID NULL,
  next_expiration_date DATE NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

### Eventos que la actualizan
- `BagCreated`
- `BagActivated`
- `InvoiceConsumed`
- `ConsumptionReversed`
- `BagDepleted`
- `BagExpired`

## 2. bag_detail_view
Representa el estado actual de una bolsa específica. Está orientada a consultas de detalle desde portal, soporte o auditoría operativa.

| Campo | Tipo | Descripción |
|---|---|---|
| `bag_id` | `UUID` | Identificador de la bolsa. Clave primaria. |
| `client_id` | `UUID` | Identificador del cliente dueño de la bolsa. |
| `crm_deal_id` | `VARCHAR(100)` | Referencia del proceso comercial en el CRM. |
| `initial_quantity` | `INTEGER` | Cantidad de facturas adquiridas originalmente. |
| `available_balance` | `INTEGER` | Saldo actual disponible. |
| `consumed_quantity` | `INTEGER` | Total consumido hasta el momento. |
| `consumed_percentage` | `NUMERIC(5,2)` | Porcentaje consumido de la bolsa. |
| `status` | `VARCHAR(30)` | Estado actual de la bolsa. |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación de la bolsa. |
| `activated_at` | `TIMESTAMPTZ` | Fecha de activación de la bolsa. |
| `expiration_date` | `DATE` | Fecha de vencimiento de la bolsa. |
| `updated_at` | `TIMESTAMPTZ` | Fecha y hora de la última actualización. |

### SQL sugerido
```sql
CREATE TABLE bag_detail_view (
  bag_id UUID PRIMARY KEY,
  client_id UUID NOT NULL,
  crm_deal_id VARCHAR(100) NULL,
  initial_quantity INTEGER NOT NULL,
  available_balance INTEGER NOT NULL,
  consumed_quantity INTEGER NOT NULL DEFAULT 0,
  consumed_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ NULL,
  expiration_date DATE NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_bag_detail_client_id
  ON bag_detail_view (client_id);

CREATE INDEX idx_bag_detail_status
  ON bag_detail_view (status);

CREATE INDEX idx_bag_detail_expiration_date
  ON bag_detail_view (expiration_date);
```

### Eventos que la actualizan
- `BagCreated`
- `BagActivated`
- `InvoiceConsumed`
- `ConsumptionReversed`
- `BagDepleted`
- `BagExpiringSoon`
- `BagExpired`

## 3. consumption_history_view
Es la tabla principal para trazabilidad y auditoría. Registra cada movimiento relevante que afectó a la bolsa o explica su estado actual.

| Campo | Tipo | Descripción |
|---|---|---|
| `movement_id` | `UUID` | Identificador del movimiento. Clave primaria. |
| `event_id` | `UUID` | Evento de dominio que originó el movimiento. |
| `bag_id` | `UUID` | Bolsa afectada. |
| `client_id` | `UUID` | Cliente propietario de la bolsa. |
| `invoice_id` | `VARCHAR(100)` | Factura asociada al movimiento, si aplica. |
| `movement_type` | `VARCHAR(50)` | Tipo de movimiento registrado. |
| `quantity` | `INTEGER` | Cantidad afectada por el movimiento. |
| `resulting_balance` | `INTEGER` | Saldo de la bolsa después del movimiento. |
| `reason` | `VARCHAR(255)` | Motivo de anulación o detalle adicional, si aplica. |
| `actor` | `VARCHAR(100)` | Usuario o sistema que originó el evento. |
| `source_system` | `VARCHAR(100)` | Sistema origen del evento. |
| `occurred_at` | `TIMESTAMPTZ` | Fecha y hora del movimiento. |

### SQL sugerido
```sql
CREATE TABLE consumption_history_view (
  movement_id UUID PRIMARY KEY,
  event_id UUID NOT NULL,
  bag_id UUID NOT NULL,
  client_id UUID NOT NULL,
  invoice_id VARCHAR(100) NULL,
  movement_type VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  resulting_balance INTEGER NOT NULL,
  reason VARCHAR(255) NULL,
  actor VARCHAR(100) NULL,
  source_system VARCHAR(100) NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_consumption_history_bag_occurred_at
  ON consumption_history_view (bag_id, occurred_at DESC);

CREATE INDEX idx_consumption_history_client_occurred_at
  ON consumption_history_view (client_id, occurred_at DESC);

CREATE INDEX idx_consumption_history_invoice_id
  ON consumption_history_view (invoice_id);
```

### Tipos de movimiento sugeridos
- `BAG_CREATED`
- `BAG_ACTIVATED`
- `INVOICE_CONSUMED`
- `CONSUMPTION_REVERSED`
- `BAG_DEPLETED`
- `BAG_EXPIRING_SOON`
- `BAG_EXPIRED`

### Eventos que la actualizan
- Todos los eventos relevantes del dominio asociados a la bolsa.

## 4. bag_alert_view
Permite consultar alertas generadas por reglas de consumo o vencimiento, y seguir su estado de envío.

| Campo | Tipo | Descripción |
|---|---|---|
| `alert_id` | `UUID` | Identificador de la alerta. Clave primaria. |
| `event_id` | `UUID` | Evento que originó la alerta. |
| `bag_id` | `UUID` | Bolsa relacionada con la alerta. |
| `client_id` | `UUID` | Cliente relacionado. |
| `alert_type` | `VARCHAR(50)` | Tipo de alerta generada. |
| `alert_status` | `VARCHAR(30)` | Estado actual de la alerta. |
| `channel` | `VARCHAR(50)` | Canal usado para el envío. |
| `recipient` | `VARCHAR(200)` | Destinatario de la notificación. |
| `generated_at` | `TIMESTAMPTZ` | Fecha de generación de la alerta. |
| `sent_at` | `TIMESTAMPTZ` | Fecha efectiva de envío, si aplica. |
| `details` | `JSONB` | Información complementaria útil para soporte o reintentos. |

### SQL sugerido
```sql
CREATE TABLE bag_alert_view (
  alert_id UUID PRIMARY KEY,
  event_id UUID NOT NULL,
  bag_id UUID NOT NULL,
  client_id UUID NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  alert_status VARCHAR(30) NOT NULL,
  channel VARCHAR(50) NULL,
  recipient VARCHAR(200) NULL,
  generated_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NULL,
  details JSONB NULL
);

CREATE INDEX idx_bag_alert_client_id
  ON bag_alert_view (client_id);

CREATE INDEX idx_bag_alert_type
  ON bag_alert_view (alert_type);

CREATE INDEX idx_bag_alert_status
  ON bag_alert_view (alert_status);
```

### Tipos de alerta sugeridos
- `THRESHOLD_80_PERCENT`
- `BAG_DEPLETED`
- `BAG_EXPIRING_SOON`

### Estados sugeridos
- `PENDING`
- `SENT`
- `FAILED`

### Eventos que la actualizan
- `BagReached80Percent`
- `BagDepleted`
- `BagExpiringSoon`

## 5. consumption_bi_view
Está orientada a analítica y reportes. Resume información de consumo por día para facilitar explotación desde herramientas de BI.

| Campo | Tipo | Descripción |
|---|---|---|
| `report_date` | `DATE` | Día al que corresponde el agregado. |
| `client_id` | `UUID` | Cliente relacionado. |
| `bag_id` | `UUID` | Bolsa relacionada. |
| `consumed_invoices` | `INTEGER` | Número de consumos realizados en el día. |
| `reversed_invoices` | `INTEGER` | Número de anulaciones realizadas en el día. |
| `opening_balance` | `INTEGER` | Saldo con el que empezó el día. |
| `closing_balance` | `INTEGER` | Saldo con el que terminó el día. |
| `accumulated_consumed_percentage` | `NUMERIC(5,2)` | Porcentaje consumido acumulado al cierre del día. |
| `bag_status` | `VARCHAR(30)` | Estado de la bolsa al cierre del día. |
| `updated_at` | `TIMESTAMPTZ` | Fecha y hora de última actualización. |

### SQL sugerido
```sql
CREATE TABLE consumption_bi_view (
  report_date DATE NOT NULL,
  client_id UUID NOT NULL,
  bag_id UUID NOT NULL,
  consumed_invoices INTEGER NOT NULL DEFAULT 0,
  reversed_invoices INTEGER NOT NULL DEFAULT 0,
  opening_balance INTEGER NOT NULL,
  closing_balance INTEGER NOT NULL,
  accumulated_consumed_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
  bag_status VARCHAR(30) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (report_date, client_id, bag_id)
);

CREATE INDEX idx_consumption_bi_client_report_date
  ON consumption_bi_view (client_id, report_date);

CREATE INDEX idx_consumption_bi_bag_report_date
  ON consumption_bi_view (bag_id, report_date);
```

### Eventos que la actualizan
- `BagCreated`
- `InvoiceConsumed`
- `ConsumptionReversed`
- `BagDepleted`
- `BagExpired`

## 6. projection_checkpoint
Es una tabla técnica, no una proyección de negocio. Permite saber hasta qué evento procesó cada proyector y facilita reprocesamiento e idempotencia.

| Campo | Tipo | Descripción |
|---|---|---|
| `projection_name` | `VARCHAR(100)` | Nombre único del proyector. Clave primaria. |
| `last_event_id` | `UUID` | Último evento procesado exitosamente. |
| `last_processed_at` | `TIMESTAMPTZ` | Fecha y hora del último procesamiento. |

### SQL sugerido
```sql
CREATE TABLE projection_checkpoint (
  projection_name VARCHAR(100) PRIMARY KEY,
  last_event_id UUID NOT NULL,
  last_processed_at TIMESTAMPTZ NOT NULL
);
```

## Resumen del modelo de lectura
- `client_balance_view`: resumen de saldo total por cliente.
- `bag_detail_view`: estado actual de cada bolsa.
- `consumption_history_view`: trazabilidad completa de movimientos.
- `bag_alert_view`: seguimiento de alertas y notificaciones.
- `consumption_bi_view`: agregado analítico para reporting.
- `projection_checkpoint`: control técnico del procesamiento de proyecciones.