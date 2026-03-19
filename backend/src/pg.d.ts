declare module "pg" {
	export interface QueryResultRow {
		[column: string]: unknown;
	}

	export interface QueryResult<T extends QueryResultRow = QueryResultRow> {
		rows: T[];
	}

	export class Pool {
		constructor(config?: Record<string, unknown>);
		query<T extends QueryResultRow = QueryResultRow>(
			sql: string,
			params?: unknown[]
		): Promise<QueryResult<T>>;
		end(): Promise<void>;
	}
}
