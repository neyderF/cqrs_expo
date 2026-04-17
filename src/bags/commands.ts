import { ICommand, IQuery } from '@nestjs/cqrs';

export class CreateBagCommand implements ICommand {
  constructor(
    public readonly bagId: string,
    public readonly clientId: string,
    public readonly initialQuantity: number,
    public readonly occurredAt: string,
  ) {}
}

export class ConsumeInvoiceCommand implements ICommand {
  constructor(
    public readonly commandId: string,
    public readonly clientId: string,
    public readonly invoiceId: string,
    public readonly quantity: number,
    public readonly occurredAt: string,
    public readonly sourceSystem: string,
  ) {}
}

export class GetClientConsolidatedQuery implements IQuery {
  constructor(public readonly clientId: string) {}
}
