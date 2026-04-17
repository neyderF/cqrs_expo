import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { ConsumeInvoiceCommand } from '../commands';
import { BagAggregate } from '../bag.aggregate';
import { InvoiceConsumedEvent } from '../events';
import { EventStoreService } from '../../shared/event-store.service';

@Injectable()
@CommandHandler(ConsumeInvoiceCommand)
export class ConsumeInvoiceHandler implements ICommandHandler<ConsumeInvoiceCommand> {
  constructor(
    private readonly eventStore: EventStoreService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: ConsumeInvoiceCommand) {
    let bagId: string | null;

    try {
      bagId = await this.eventStore.findActiveBagIdByClient(command.clientId);
    } catch (error) {
      throw new InternalServerErrorException((error as Error).message);
    }

    if (!bagId) {
      throw new ConflictException('The client does not have an active bag with balance');
    }

    const events = await this.eventStore.getByAggregateId(bagId);
    const aggregate = BagAggregate.rehydrate(events);
    const domainEvent: InvoiceConsumedEvent = aggregate.consumeInvoice(
      command.invoiceId,
      command.quantity,
      command.occurredAt,
      command.sourceSystem,
    );

    await this.eventStore.append({
      id: randomUUID(),
      aggregateId: bagId,
      aggregateType: 'BagConsumption',
      eventType: 'InvoiceConsumed',
      occurredAt: command.occurredAt,
      payload: {
        bagId: domainEvent.bagId,
        clientId: domainEvent.clientId,
        invoiceId: domainEvent.invoiceId,
        quantity: domainEvent.quantity,
        resultingBalance: domainEvent.resultingBalance,
        sourceSystem: domainEvent.sourceSystem,
      },
    });

    this.eventBus.publish(domainEvent);

    return {
      message: 'Invoice consumed successfully',
      bagId,
      clientId: command.clientId,
      invoiceId: command.invoiceId,
      remainingBalance: domainEvent.resultingBalance,
    };
  }
}
