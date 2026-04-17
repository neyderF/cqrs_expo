import { ConflictException, Injectable } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'crypto';
import { CreateBagCommand } from '../commands';
import { BagAggregate } from '../bag.aggregate';
import { BagCreatedEvent } from '../events';
import { EventStoreService } from '../../shared/event-store.service';

@Injectable()
@CommandHandler(CreateBagCommand)
export class CreateBagHandler implements ICommandHandler<CreateBagCommand> {
  constructor(
    private readonly eventStore: EventStoreService,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateBagCommand) {
    const existingActiveBag = await this.eventStore.findActiveBagIdByClient(command.clientId);
    if (existingActiveBag) {
      throw new ConflictException('The client already has an active bag');
    }

    const domainEvent: BagCreatedEvent = BagAggregate.create(
      command.bagId,
      command.clientId,
      command.initialQuantity,
      command.occurredAt,
    );

    await this.eventStore.append({
      id: randomUUID(),
      aggregateId: command.bagId,
      aggregateType: 'BagConsumption',
      eventType: 'BagCreated',
      occurredAt: command.occurredAt,
      payload: {
        bagId: domainEvent.bagId,
        clientId: domainEvent.clientId,
        initialQuantity: domainEvent.initialQuantity,
      },
    });

    this.eventBus.publish(domainEvent);

    return {
      message: 'Bag created successfully',
      bagId: command.bagId,
      clientId: command.clientId,
      initialQuantity: command.initialQuantity,
    };
  }
}
