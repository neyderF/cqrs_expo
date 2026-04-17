# Modelo de Escritura

## Propósito
El modelo de escritura concentra la lógica de negocio que modifica el estado del sistema. En este caso, su responsabilidad es recibir comandos, validar reglas sobre las bolsas de consumo y persistir hechos del dominio en el Event Store.

En una arquitectura con CQRS y Event Sourcing, el modelo de escritura no guarda como fuente principal una tabla con el estado actual de la bolsa. En cambio, registra eventos de dominio que permiten reconstruir su estado y explicar cómo se llegó a él.

## Principios del modelo de escritura
- Es la fuente principal de verdad del dominio.
- Está orientado a proteger reglas de negocio, no a facilitar consultas complejas.
- Persiste eventos inmutables en lugar de actualizar el estado actual como verdad principal.
- Puede reconstruir el estado de un aggregate a partir de eventos o snapshots.
- Debe soportar idempotencia y concurrencia optimista.
- Un cliente solo puede tener una bolsa activa al tiempo.

## 1. Aggregate principal: BolsaConsumo
El aggregate `BolsaConsumo` es el guardián de las reglas del negocio relacionadas con una bolsa adquirida por un cliente.

### Estado lógico mínimo del aggregate
| Campo | Tipo | Descripción |
|---|---|---|
| `bagId` | `UUID` | Identificador único de la bolsa. |
| `clientId` | `UUID` | Cliente propietario de la bolsa. |
| `crmDealId` | `VARCHAR(100)` | Referencia del proceso comercial en el CRM. |
| `initialQuantity` | `INTEGER` | Cantidad de facturas adquiridas originalmente. |
| `availableBalance` | `INTEGER` | Saldo actual disponible para consumo. |
| `status` | `VARCHAR(30)` | Estado actual de la bolsa. |
| `expirationDate` | `DATE` | Fecha de vencimiento de la bolsa. |
| `version` | `INTEGER` | Última versión aplicada al aggregate. |
| `threshold80AlertRaised` | `BOOLEAN` | Indica si ya se registró la alerta del 80 por ciento. |
| `depletedAlertRaised` | `BOOLEAN` | Indica si ya se registró el agotamiento. |
| `processedConsumptions` | `SET/colección lógica` | Identificadores de consumos ya aplicados para garantizar idempotencia. |

### Reglas de negocio asociadas
- Un cliente solo puede tener una bolsa activa al tiempo.
- No se puede consumir una bolsa sin saldo disponible.
- No se puede consumir una bolsa vencida.
- No se puede consumir dos veces la misma factura.
- Toda anulación debe quedar registrada como hecho de negocio.
- Las alertas de 80 por ciento y agotamiento deben emitirse una sola vez.
- Si no existe bolsa activa para el cliente, el consumo debe rechazarse.
- Si existieran varias bolsas activas para el mismo cliente, el sistema debe rechazar la operación por inconsistencia.

## 2. Comandos del modelo de escritura
Los comandos representan intención de cambio. No son hechos consumados, sino solicitudes de negocio que deben validarse.

### CrearBolsaCommand
| Campo | Tipo | Descripción |
|---|---|---|
| `commandId` | `UUID` | Identificador único del comando para idempotencia técnica. |
| `bagId` | `UUID` | Identificador de la nueva bolsa. |
| `clientId` | `UUID` | Cliente al que se asigna la bolsa. |
| `crmDealId` | `VARCHAR(100)` | Referencia comercial desde el CRM. |
| `initialQuantity` | `INTEGER` | Cantidad adquirida. |
| `expirationDate` | `DATE` | Fecha de vencimiento de la bolsa. |
| `createdBy` | `VARCHAR(100)` | Usuario o sistema origen. |
| `occurredAt` | `TIMESTAMPTZ` | Fecha y hora del comando. |

### ActivarBolsaCommand
| Campo | Tipo | Descripción |
|---|---|---|
| `commandId` | `UUID` | Identificador único del comando. |
| `bagId` | `UUID` | Bolsa a activar. |
| `activatedBy` | `VARCHAR(100)` | Actor que realiza la activación. |
| `occurredAt` | `TIMESTAMPTZ` | Fecha y hora del comando. |

### ConsumirFacturaCommand
| Campo | Tipo | Descripción |
|---|---|---|
| `commandId` | `UUID` | Identificador único del comando. |
| `clientId` | `UUID` | Cliente asociado. |
| `invoiceId` | `VARCHAR(100)` | Factura que origina el consumo. |
| `quantity` | `INTEGER` | Cantidad a descontar. |
| `issuedAt` | `TIMESTAMPTZ` | Fecha de emisión de la factura. |
| `sourceSystem` | `VARCHAR(100)` | Sistema que solicita el consumo. |

En este caso el comando no requiere `bagId` como dato de entrada. El sistema resuelve internamente qué bolsa debe consumir porque la regla de negocio establece que un cliente solo puede tener una bolsa activa al tiempo.

### AnularConsumoCommand
| Campo | Tipo | Descripción |
|---|---|---|
| `commandId` | `UUID` | Identificador único del comando. |
| `bagId` | `UUID` | Bolsa afectada. |
| `invoiceId` | `VARCHAR(100)` | Factura cuyo consumo será anulado. |
| `reason` | `VARCHAR(255)` | Motivo de la anulación. |
| `requestedBy` | `VARCHAR(100)` | Usuario o sistema que la solicita. |
| `occurredAt` | `TIMESTAMPTZ` | Fecha y hora del comando. |

### MarcarBolsaVencidaCommand
| Campo | Tipo | Descripción |
|---|---|---|
| `commandId` | `UUID` | Identificador único del comando. |
| `bagId` | `UUID` | Bolsa a marcar como vencida. |
| `executedAt` | `TIMESTAMPTZ` | Fecha y hora de la marcación. |
| `sourceSystem` | `VARCHAR(100)` | Job o proceso que dispara el cambio. |

## 3. Eventos de dominio
Los eventos son hechos ya ocurridos. Constituyen la fuente de verdad del modelo de escritura.

### Eventos principales
- `BagCreated`
- `BagActivated`
- `InvoiceConsumed`
- `ConsumptionReversed`
- `BagReached80Percent`
- `BagDepleted`
- `BagExpiringSoon`
- `BagExpired`

### Payload base sugerido para todos los eventos
| Campo | Tipo | Descripción |
|---|---|---|
| `eventId` | `UUID` | Identificador único del evento. |
| `aggregateId` | `UUID` | Identificador del aggregate afectado. |
| `aggregateType` | `VARCHAR(100)` | Tipo de aggregate, en este caso `BolsaConsumo`. |
| `version` | `INTEGER` | Versión del aggregate después de aplicar el evento. |
| `eventType` | `VARCHAR(150)` | Tipo de evento. |
| `occurredAt` | `TIMESTAMPTZ` | Fecha y hora del hecho. |
| `payload` | `JSONB` | Datos específicos del evento. |
| `causationId` | `UUID` | Comando o evento que causó este evento. |
| `correlationId` | `UUID` | Correlación para trazabilidad de extremo a extremo. |
| `sourceSystem` | `VARCHAR(100)` | Sistema que originó la acción. |

### Significado de `eventType`, `causationId` y `correlationId`
| Campo | Qué responde | Ejemplo |
|---|---|---|
| `eventType` | Qué ocurrió | `InvoiceConsumed` |
| `causationId` | Qué causó directamente este evento | `cmd-123` o `evt-900` |
| `correlationId` | A qué flujo completo de negocio pertenece | `corr-555` |

### Ejemplo de flujo con metadatos
Supongamos este flujo:
1. El sistema X envía `ConsumirFacturaCommand` con `commandId = cmd-123`.
2. Ese comando genera el evento `InvoiceConsumed` con `eventId = evt-900`.
3. Como resultado del nuevo saldo, el sistema genera `BagReached80Percent` con `eventId = evt-901`.

Entonces los metadatos quedarían así:

| event_id | event_type | causation_id | correlation_id | Explicación |
|---|---|---|---|---|
| `evt-900` | `InvoiceConsumed` | `cmd-123` | `corr-555` | El evento fue causado directamente por el comando de consumo. |
| `evt-901` | `BagReached80Percent` | `evt-900` | `corr-555` | La alerta de umbral fue causada por el evento de consumo, pero pertenece al mismo flujo. |

La regla práctica es:
- `eventType`: nombra el hecho ocurrido.
- `causationId`: apunta a la causa inmediata.
- `correlationId`: agrupa toda la cadena de extremo a extremo.

## 4. Event Store
Es la tabla principal de persistencia del write side. Guarda la secuencia de hechos del dominio de manera append-only.

| Campo | Tipo | Descripción |
|---|---|---|
| `event_id` | `UUID` | Identificador único del evento. Clave primaria. |
| `aggregate_id` | `UUID` | Aggregate afectado. |
| `aggregate_type` | `VARCHAR(100)` | Tipo de aggregate. |
| `version` | `INTEGER` | Secuencia del evento dentro del aggregate. |
| `event_type` | `VARCHAR(150)` | Tipo del evento. |
| `payload` | `JSONB` | Datos específicos del evento. |
| `occurred_at` | `TIMESTAMPTZ` | Fecha y hora del evento. |
| `causation_id` | `UUID` | Identificador del comando o evento causante. |
| `correlation_id` | `UUID` | Identificador de correlación del flujo. |
| `source_system` | `VARCHAR(100)` | Sistema origen. |

En este caso, el `aggregate_id` corresponde al `bagId` de la bolsa consumida o afectada.

### SQL sugerido
```sql
CREATE TABLE events (
  event_id UUID PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL,
  event_type VARCHAR(150) NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  causation_id UUID NULL,
  correlation_id UUID NULL,
  source_system VARCHAR(100) NULL,
  UNIQUE (aggregate_id, version)
);

CREATE INDEX idx_events_aggregate_id_version
  ON events (aggregate_id, version);

CREATE INDEX idx_events_event_type
  ON events (event_type);

CREATE INDEX idx_events_occurred_at
  ON events (occurred_at);
```

## 5. Snapshot Store
Los snapshots son fotografías del estado del aggregate en una versión determinada. Permiten evitar la reconstrucción completa desde el primer evento cuando el stream crece demasiado.

| Campo | Tipo | Descripción |
|---|---|---|
| `aggregate_id` | `UUID` | Aggregate asociado. Clave primaria. |
| `aggregate_type` | `VARCHAR(100)` | Tipo de aggregate. |
| `version` | `INTEGER` | Versión hasta la que el snapshot representa el estado. |
| `state_payload` | `JSONB` | Estado serializado del aggregate. |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación del snapshot. |

### SQL sugerido
```sql
CREATE TABLE snapshots (
  aggregate_id UUID PRIMARY KEY,
  aggregate_type VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL,
  state_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
```

### Ejemplo de state_payload
```json
{
  "bagId": "uuid",
  "clientId": "uuid",
  "initialQuantity": 100,
  "availableBalance": 42,
  "status": "ACTIVE",
  "expirationDate": "2026-12-31",
  "threshold80AlertRaised": true,
  "depletedAlertRaised": false
}
```

## 6. Outbox
La outbox permite publicar eventos de forma confiable después de persistirlos, sin caer en dual write frágil. En un monolito modular, puede usarse para desacoplar proyecciones, notificaciones y otros procesos internos.

| Campo | Tipo | Descripción |
|---|---|---|
| `outbox_id` | `UUID` | Identificador del registro en outbox. Clave primaria. |
| `event_id` | `UUID` | Evento asociado. |
| `topic` | `VARCHAR(150)` | Categoría lógica del mensaje. |
| `payload` | `JSONB` | Carga a publicar o procesar. |
| `status` | `VARCHAR(30)` | Estado del mensaje. |
| `retry_count` | `INTEGER` | Número de intentos de publicación. |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación. |
| `published_at` | `TIMESTAMPTZ` | Fecha de publicación efectiva. |

### SQL sugerido
```sql
CREATE TABLE outbox (
  outbox_id UUID PRIMARY KEY,
  event_id UUID NOT NULL,
  topic VARCHAR(150) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(30) NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_outbox_status_created_at
  ON outbox (status, created_at);
```

### Estados sugeridos
- `PENDING`
- `PUBLISHED`
- `FAILED`

## 7. processed_commands
Es una tabla técnica opcional. Sirve para reforzar idempotencia a nivel de comandos entrantes, especialmente cuando CRM o el sistema emisor pueden reenviar la misma solicitud.

| Campo | Tipo | Descripción |
|---|---|---|
| `command_id` | `UUID` | Identificador del comando. Clave primaria. |
| `source_system` | `VARCHAR(100)` | Sistema que envió el comando. |
| `command_type` | `VARCHAR(100)` | Tipo de comando procesado. |
| `aggregate_id` | `UUID` | Aggregate afectado. |
| `processed_at` | `TIMESTAMPTZ` | Fecha de procesamiento. |
| `result_status` | `VARCHAR(30)` | Resultado del procesamiento. |

### SQL sugerido
```sql
CREATE TABLE processed_commands (
  command_id UUID PRIMARY KEY,
  source_system VARCHAR(100) NOT NULL,
  command_type VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL,
  result_status VARCHAR(30) NOT NULL
);
```

### Estados sugeridos
- `PROCESSED`
- `REJECTED`
- `DUPLICATED`

## 8. Reconstrucción del aggregate
Cuando llega un comando como `ConsumirFactura`, el modelo de escritura debe conocer el estado actual de la bolsa para validar si el cambio es válido.

### Estrategia recomendada
1. Resolver la bolsa activa del cliente usando `clientId`.
2. Buscar snapshot más reciente del aggregate, si existe.
3. Leer eventos del stream de la bolsa con versión posterior al snapshot.
4. Rehidratar el aggregate aplicando esos eventos en orden.
5. Ejecutar la lógica de negocio.
6. Persistir los nuevos eventos en el Event Store.

## 9. Concurrencia e idempotencia

### Concurrencia optimista
Se recomienda usar la columna `version` del aggregate para evitar conflictos cuando dos procesos intentan consumir la misma bolsa al mismo tiempo.

La validación se apoya en:
- `expectedVersion` en el handler.
- restricción única por `aggregate_id, version` en el Event Store.

### Idempotencia
Se recomienda cubrirla en dos niveles:
- Nivel técnico: con `commandId` y tabla `processed_commands`.
- Nivel de negocio: evitando reprocesar el mismo `invoiceId` sobre la misma bolsa.

## 10. Resumen del modelo de escritura
- `Aggregate BolsaConsumo`: concentra reglas de negocio.
- `Commands`: expresan intención de cambio.
- `Events`: constituyen la fuente de verdad del dominio.
- `events`: almacena la secuencia histórica de hechos.
- `snapshots`: acelera la reconstrucción del aggregate.
- `outbox`: desacopla publicación y sincronización interna.
- `processed_commands`: refuerza idempotencia técnica.
