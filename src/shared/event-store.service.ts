import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEntity } from './entities/event.entity';

export interface StoredEvent {
  id: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  eventType: string;
  occurredAt: string;
  payload: Record<string, any>;
}

@Injectable()
export class EventStoreService {
  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
  ) {}

  async append(event: Omit<StoredEvent, 'version'> & { version?: number }): Promise<void> {
    const latest = await this.eventRepository.findOne({
      where: { aggregateId: event.aggregateId },
      order: { version: 'DESC' },
    });

    const entity = this.eventRepository.create({
      id: event.id,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      version: event.version ?? (latest?.version ?? 0) + 1,
      eventType: event.eventType,
      payload: event.payload,
      occurredAt: new Date(event.occurredAt),
    });

    await this.eventRepository.save(entity);
  }

  async getAll(): Promise<StoredEvent[]> {
    const events = await this.eventRepository.find({ order: { occurredAt: 'ASC', version: 'ASC' } });
    return events.map((event) => ({
      id: event.id,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      version: event.version,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload,
    }));
  }

  async getByAggregateId(aggregateId: string): Promise<StoredEvent[]> {
    const events = await this.eventRepository.find({
      where: { aggregateId },
      order: { version: 'ASC' },
    });

    return events.map((event) => ({
      id: event.id,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      version: event.version,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload,
    }));
  }

  async findActiveBagIdByClient(clientId: string): Promise<string | null> {
    const events = await this.eventRepository.query(
      `
      SELECT event_id, aggregate_id, aggregate_type, version, event_type, payload, occurred_at
      FROM events
      WHERE payload ->> 'clientId' = $1
      ORDER BY occurred_at ASC, version ASC
      `,
      [clientId],
    );

    const state = new Map<string, { clientId: string; balance: number; status: string }>();

    for (const event of events) {
      if (event.event_type === 'BagCreated') {
        state.set(event.aggregate_id, {
          clientId: event.payload.clientId,
          balance: Number(event.payload.initialQuantity),
          status: 'ACTIVE',
        });
      }

      if (event.event_type === 'InvoiceConsumed') {
        const current = state.get(event.aggregate_id);
        if (!current) continue;
        current.balance -= Number(event.payload.quantity);
        if (current.balance <= 0) {
          current.status = 'DEPLETED';
        }
      }
    }

    const activeBags = [...state.entries()].filter(
      ([, bag]) => bag.clientId === clientId && bag.status === 'ACTIVE' && bag.balance > 0,
    );

    if (activeBags.length > 1) {
      throw new Error(`Data inconsistency: client ${clientId} has more than one active bag`);
    }

    return activeBags[0]?.[0] ?? null;
  }
}
