import { Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetClientConsolidatedQuery } from '../commands';
import { ReadModelStoreService } from '../../shared/read-model.store';

@Injectable()
@QueryHandler(GetClientConsolidatedQuery)
export class GetClientConsolidatedHandler
  implements IQueryHandler<GetClientConsolidatedQuery>
{
  constructor(private readonly readModelStore: ReadModelStoreService) {}

  async execute(query: GetClientConsolidatedQuery) {
    return this.readModelStore.getClientConsolidated(query.clientId);
  }
}
