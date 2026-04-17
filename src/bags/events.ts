import { IEvent } from '@nestjs/cqrs';

export class BagCreatedEvent implements IEvent {
  constructor(
    public readonly bagId: string,
    public readonly clientId: string,
    public readonly initialQuantity: number,
    public readonly occurredAt: string,
  ) {}
}

export class InvoiceConsumedEvent implements IEvent {
  constructor(
    public readonly bagId: string,
    public readonly clientId: string,
    public readonly invoiceId: string,
    public readonly quantity: number,
    public readonly resultingBalance: number,
    public readonly occurredAt: string,
    public readonly sourceSystem: string,
  ) {}
}
