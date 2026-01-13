export class DtoHelper {
  static extractDtoProperties(dto: any): Record<string, any> {
    if (!dto) return {};

    const properties: Record<string, any> = {};

    Object.keys(dto).forEach((key) => {
      const value = dto[key];
      if (value && typeof value === 'object' && 'type' in value) {
        properties[key] = this.mapColumnTypeToOpenApi(value);
      }
    });

    return properties;
  }

  private static mapColumnTypeToOpenApi(column: any): any {
    const colType = column.type;

    switch (colType) {
      case 'int':
      case 'integer':
        return { type: 'integer', format: 'int32' };
      case 'bigint':
        return { type: 'integer', format: 'int64' };
      case 'varchar':
      case 'text':
      case 'string':
        return { type: 'string' };
      case 'boolean':
        return { type: 'boolean' };
      case 'decimal':
      case 'float':
      case 'double':
        return { type: 'number' };
      case 'date':
        return { type: 'string', format: 'date' };
      case 'timestamp':
      case 'datetime':
        return { type: 'string', format: 'date-time' };
      case 'uuid':
        return { type: 'string', format: 'uuid' };
      case 'json':
        return { type: 'object' };
      case 'enum':
        return { type: 'string', enum: column.values };
      default:
        return { type: 'string' };
    }
  }
}
