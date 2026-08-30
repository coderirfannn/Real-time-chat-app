import type {
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  QueryOptions,
  ProjectionType,
} from 'mongoose';

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
}

export interface PaginatedResult<T> {
  docs: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export abstract class BaseRepository<TDoc extends Document> {
  protected constructor(protected readonly model: Model<TDoc>) {}

  public async findById(
    id: string,
    projection?: ProjectionType<TDoc>,
    options?: QueryOptions<TDoc>,
  ): Promise<TDoc | null> {
    return this.model.findById(id, projection, options).exec();
  }

  public async findOne(
    filter: FilterQuery<TDoc>,
    projection?: ProjectionType<TDoc>,
    options?: QueryOptions<TDoc>,
  ): Promise<TDoc | null> {
    return this.model.findOne(filter, projection, options).exec();
  }

  public async find(
    filter: FilterQuery<TDoc> = {},
    projection?: ProjectionType<TDoc>,
    options?: QueryOptions<TDoc>,
  ): Promise<TDoc[]> {
    return this.model.find(filter, projection, options).exec();
  }

  public async create(doc: Partial<TDoc>): Promise<TDoc> {
    return this.model.create(doc);
  }

  public async updateById(
    id: string,
    update: UpdateQuery<TDoc>,
    options: QueryOptions<TDoc> = { new: true },
  ): Promise<TDoc | null> {
    return this.model.findByIdAndUpdate(id, update, options).exec();
  }

  public async updateOne(
    filter: FilterQuery<TDoc>,
    update: UpdateQuery<TDoc>,
    options: QueryOptions<TDoc> = { new: true },
  ): Promise<TDoc | null> {
    return this.model.findOneAndUpdate(filter, update, options).exec();
  }

  public async deleteById(id: string): Promise<TDoc | null> {
    return this.model.findByIdAndDelete(id).exec();
  }

  public async deleteOne(filter: FilterQuery<TDoc>): Promise<TDoc | null> {
    return this.model.findOneAndDelete(filter).exec();
  }

  public async count(filter: FilterQuery<TDoc> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }

  public async exists(filter: FilterQuery<TDoc>): Promise<boolean> {
    const result = await this.model.exists(filter).exec();
    return Boolean(result);
  }

  public async paginate(
    filter: FilterQuery<TDoc> = {},
    pagination: PaginationOptions,
    projection?: ProjectionType<TDoc>,
  ): Promise<PaginatedResult<TDoc>> {
    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, Math.min(100, pagination.limit));
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      this.model
        .find(filter, projection)
        .sort(pagination.sort || { createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.count(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      docs,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }
}
