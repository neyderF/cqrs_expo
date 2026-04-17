import { BadRequestException, ConflictException } from '@nestjs/common';
import { BagCreatedEvent, InvoiceConsumedEvent } from './events';
import { StoredEvent } from '../shared/event-store.service';

export class BagAggregate {
  bagId!: string;
  clientId!: string;
  initialQuantity = 0;
  availableBalance = 0;
  status: 'ACTIVE' | 'DEPLETED' = 'ACTIVE';
  private readonly processedInvoices = new Set<string>();

  static rehydrate(events: StoredEvent[]): BagAggregate {
    const aggregate = new BagAggregate();
    for (const event of events) {
      aggregate.apply(event);
    }
    return aggregate;
  }

  static create(bagId: string, clientId: string, initialQuantity: number, occurredAt: string) {
    if (initialQuantity <= 0) {
      throw new BadRequestException('Initial quantity must be greater than zero');
    }

    return new BagCreatedEvent(bagId, clientId, initialQuantity, occurredAt);
  }

  consumeInvoice(invoiceId: string, quantity: number, occurredAt: string, sourceSystem: string) {
    if (this.status !== 'ACTIVE') {
      throw new ConflictException('The bag is not active');
    }

    if (this.processedInvoices.has(invoiceId)) {
      throw new ConflictException('This invoice has already been consumed');
    }

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    if (this.availableBalance < quantity) {
      throw new ConflictException('Insufficient balance in active bag');
    }

    return new InvoiceConsumedEvent(
      this.bagId,
      this.clientId,
      invoiceId,
      quantity,
      this.availableBalance - quantity,
      occurredAt,
      sourceSystem,
    );
  }

  private apply(event: StoredEvent): void {
    if (event.eventType === 'BagCreated') {
      this.bagId = event.payload.bagId;
      this.clientId = event.payload.clientId;
      this.initialQuantity = event.payload.initialQuantity;
      this.availableBalance = event.payload.initialQuantity;
      this.status = 'ACTIVE';
    }

    if (event.eventType === 'InvoiceConsumed') {
      this.availableBalance -= event.payload.quantity;
      this.processedInvoices.add(event.payload.invoiceId);
      if (this.availableBalance <= 0) {
        this.status = 'DEPLETED';
      }
    }
  }
}
